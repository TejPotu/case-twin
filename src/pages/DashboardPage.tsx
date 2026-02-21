import { useCallback, useRef, useState, useMemo, useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useDashboardStore } from "@/store/dashboardStore";
import { Check, FileText, Loader2, MapPin, Settings, Settings2, Sparkles, Stethoscope, FolderOpen, Plus, HeartPulse, CloudOff, Scan, Microscope, Activity } from "lucide-react";
import { searchByImage, type MatchItem as ApiMatchItem } from "@/lib/mockUploadApis";
import { computeProfileConfidence } from "@/lib/caseProfileUtils";
import { emptyProfile, type CaseProfile } from "@/lib/caseProfileTypes";
import { CaseProfileView } from "@/components/CaseProfileView";
import { AgenticCopilotPanel } from "@/components/AgenticCopilotPanel";
import { TwinProfileModal } from "@/components/TwinProfileModal";
import { TwinChatPanel } from "@/components/TwinChatPanel";
import { cn } from "@/lib/utils";
import { X, ChevronLeft } from "lucide-react";

type Step = 0 | 1 | 2 | 3;
type OutcomeVariant = "success" | "warning" | "neutral";

interface MatchItem {
  score: number;
  diagnosis: string;
  summary: string;
  facility: string;
  outcome: string;
  outcomeVariant: "success" | "warning" | "neutral";
  image_url: string; // <-- Remove optional since mockUploadApis promises a string
  age?: number;
  gender?: string;
  pmc_id?: string;
  article_title?: string;
  journal?: string;
  year?: string;
  radiology_view?: string;
  case_text?: string;
  raw_payload?: Record<string, any>;
}

interface RouteCenter {
  name: string;
  capability: string;
  travel: string;
  reason: string;
}

const stepLabels = ["Upload", "Matches", "Route", "Memo"] as const;

const matchItems: MatchItem[] = [
  {
    score: 98,
    diagnosis: "Bilateral ground-glass opacities",
    summary: "High concordance with presentation of acute hypoxemic respiratory failure.",
    facility: "Mayo Clinic",
    outcome: "Discharged at 14 days",
    outcomeVariant: "success",
    image_url: ""
  },
  {
    score: 82,
    diagnosis: "Acute respiratory distress syndrome",
    summary: "Matches pattern of diffuse bilateral alveolar damage.",
    facility: "Cleveland Clinic",
    outcome: "Recovered via ECMO",
    outcomeVariant: "success",
    image_url: ""
  },
  {
    score: 85,
    diagnosis: "Atypical pneumonia",
    summary: "Similar peripheral distribution but less extensive consolidation.",
    facility: "Mass General",
    outcome: "Required ICU transfer",
    outcomeVariant: "warning",
    image_url: ""
  },
  {
    score: 74,
    diagnosis: "Pulmonary alveolar proteinosis",
    summary: "Some morphological overlap in 'crazy-paving' pattern.",
    facility: "Johns Hopkins",
    outcome: "Improved post-lavage",
    outcomeVariant: "success",
    image_url: ""
  },
  {
    score: 61,
    diagnosis: "Pulmonary edema",
    summary: "Lower confidence match due to presence of cardiomegaly.",
    facility: "UCSF Medical Center",
    outcome: "Ongoing diuretic therapy",
    outcomeVariant: "neutral",
    image_url: ""
  }
];

const routeCenters: RouteCenter[] = [
  {
    name: "Mayo Clinic — Rochester",
    capability: "100%",
    travel: "2h 10m",
    reason: "Interventional Pulmonology + Thoracic Oncology"
  },
  {
    name: "Cleveland Clinic",
    capability: "95%",
    travel: "1h 55m",
    reason: "Thoracic surgery + Clinical trials"
  },
  {
    name: "Mass General",
    capability: "90%",
    travel: "3h 05m",
    reason: "Radiation oncology + Research program"
  }
];

function SurfaceCard({
  className,
  children,
  label,
  title,
}: {
  className?: string;
  children: ReactNode;
  label?: string;
  title?: string;
}) {
  return (
    <section className={cn("mr-surface", className)}>
      {(label || title) && (
        <div className="mb-3">
          {label && <p className="mr-label">{label}</p>}
          {title && <h2 className="mr-title">{title}</h2>}
        </div>
      )}
      {children}
    </section>
  );
}

function MedButton({
  className,
  variant,
  size = "default",
  fullWidth,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant: "primary" | "secondary" | "tertiary";
  size?: "default" | "sm";
  fullWidth?: boolean;
}) {
  return (
    <button
      className={cn(
        "mr-btn",
        variant === "primary" && "mr-btn--primary",
        variant === "secondary" && "mr-btn--secondary",
        variant === "tertiary" && "mr-btn--tertiary",
        size === "sm" && "mr-btn--sm",
        fullWidth && "mr-btn--full",
        className
      )}
      {...props}
    />
  );
}

function LabeledCheckbox({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-[15px] leading-[22px] text-[var(--mr-text)]">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        data-checked={checked}
        className="mr-checkbox"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <span>{label}</span>
    </label>
  );
}

function OutcomeBadge({ variant, label }: { variant: OutcomeVariant; label: string }) {
  return (
    <span
      className={cn(
        "mr-badge border border-zinc-200",
        variant === "success" && "mr-badge--success",
        variant === "warning" && "mr-badge--warning",
        variant === "neutral" && "mr-badge--neutral"
      )}
    >
      {label}
    </span>
  );
}

function Stepper({ step, onStepChange }: { step: Step; onStepChange: (next: Step) => void }) {
  return (
    <ol className="flex flex-wrap items-center justify-center gap-2">
      {stepLabels.map((label, idx) => {
        const state = idx < step ? "done" : idx === step ? "active" : "default";
        const nextStep = idx as Step;

        return (
          <li key={label}>
            <button
              type="button"
              onClick={() => onStepChange(nextStep)}
              aria-current={idx === step ? "step" : undefined}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-4 text-xs leading-4 transition-colors",
                state === "default" &&
                "bg-transparent text-[var(--mr-text-secondary)] hover:bg-[var(--mr-bg-subtle)] hover:text-[var(--mr-text)]",
                state === "active" && "bg-[var(--mr-action)] font-semibold text-[var(--mr-on-action)]",
                state === "done" && "bg-[var(--mr-bg-subtle)] text-[var(--mr-text)]"
              )}
            >
              {state === "done" ? <Check className="h-3 w-3" /> : null}
              <span>{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function UploadScreen({
  onImageFilePicked,
  onStepChange,
}: {
  deIdentify?: boolean;
  saveToHistory?: boolean;
  onDeIdentifyChange?: (next: boolean) => void;
  onSaveHistoryChange?: (next: boolean) => void;
  onImageFilePicked: (file: File | null) => void;
  onStepChange: (step: Step) => void;
}) {
  const profile = useDashboardStore(s => s.profile);
  const setProfile = useDashboardStore(s => s.setProfile);

  const conf = profile ? computeProfileConfidence(profile) : { score: 0, filled: 0, total: 13, missing: [] };

  const handleProfileUpdate = useCallback((updated: CaseProfile) => {
    setProfile(updated);
  }, [setProfile]);

  const handleFileForSearch = useCallback((file: File) => {
    onImageFilePicked(file);
  }, [onImageFilePicked]);

  const handleReadyToProceed = useCallback(() => {
    onStepChange(1); // advance to Review
  }, [onStepChange]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPct, setLeftPct] = useState(50);
  const isDragging = useRef(false);

  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.max(25, Math.min(75, pct)));
    };
    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex h-[calc(100vh-100px)] gap-0 pt-6"
      style={{ overflow: "hidden" }}
    >
      {/* ── Left: Live Case Profile ── */}
      <div
        className="flex flex-col gap-4 overflow-hidden h-full pr-3 pb-6 relative"
        style={{ width: `${leftPct}%`, minWidth: 0 }}
      >
        <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden flex flex-col flex-1 h-full min-h-0">
          {/* Header Section (Always Visible) */}
          <div className="px-8 pt-8 pb-5 border-b border-zinc-100 bg-zinc-50/50 flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm">
                <FileText className="h-5 w-5 text-zinc-700" />
              </div>
              <div>
                <h2 className="text-[22px] font-semibold tracking-tight text-zinc-900 leading-none">Case Profile</h2>
                <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-zinc-500">
                  <Stethoscope className="h-3.5 w-3.5 text-[var(--mr-action)]" /> MedGemma Extracted
                </p>
              </div>
            </div>

            {/* Inline Extraction Quality */}
            <div className="flex flex-col items-end">
              <span className={cn(
                "text-[12px] font-semibold px-2 py-0.5 rounded-md border",
                conf.score >= 80 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : conf.score >= 50 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-zinc-100 text-zinc-700 border-zinc-200"
              )}>
                {conf.score}% Complete
              </span>
            </div>
          </div>

          {/* Content Section */}
          <div className="flex-1 overflow-y-auto w-full relative">
            {profile && conf.score > 0 ? (
              <div className="p-8 pb-32 transition-all">
                <CaseProfileView profile={profile} />
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-zinc-50/20 group">
                <div className="absolute inset-0 bg-gradient-to-tr from-white via-transparent to-zinc-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>

                <div className="flex flex-col items-center justify-center gap-5 text-center max-w-[320px] relative z-10 transition-transform duration-500 group-hover:-translate-y-1">
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-sm border border-zinc-200/60 ring-4 ring-white">
                    <div className="absolute inset-0 rounded-2xl bg-zinc-100/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <HeartPulse className="h-8 w-8 text-zinc-400 group-hover:text-rose-500 transition-colors duration-500" strokeWidth={1.5} />
                    <div className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm border border-zinc-200/60">
                      <FileText className="h-3.5 w-3.5 text-zinc-400" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-[17px] font-semibold text-zinc-900 tracking-tight">Case Profile Empty</h3>
                    <p className="text-[14px] leading-relaxed text-zinc-500">
                      Talk to the Copilot on the right. Share patient evidence, labs, and imaging to watch the intelligent case profile automatically appear here.
                    </p>
                  </div>

                  <div className="mt-2 flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-zinc-200/60 shadow-sm text-[13px] font-medium text-zinc-500 transition-all duration-300 group-hover:shadow-md group-hover:border-zinc-300/60">
                    <Loader2 className="w-3.5 h-3.5 animate-[spin_3s_linear_infinite] text-zinc-400" />
                    Waiting for evidence...
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Drag Divider ── */}
      <div
        className="group relative z-10 flex w-3 shrink-0 cursor-col-resize items-center justify-center"
        onMouseDown={onDividerMouseDown}
      >
        <div className="h-full w-px bg-[var(--mr-border)] transition-colors group-hover:bg-[var(--mr-action)]" />
        <div className="absolute flex h-6 w-3 flex-col items-center justify-center gap-0.5 rounded-full">
          <span className="h-0.5 w-0.5 rounded-full bg-[var(--mr-text-secondary)] group-hover:bg-[var(--mr-action)]" />
          <span className="h-0.5 w-0.5 rounded-full bg-[var(--mr-text-secondary)] group-hover:bg-[var(--mr-action)]" />
          <span className="h-0.5 w-0.5 rounded-full bg-[var(--mr-text-secondary)] group-hover:bg-[var(--mr-action)]" />
        </div>
      </div>

      {/* ── Right: Full-height Agentic Copilot ── */}
      <div
        className="relative flex h-full min-h-[500px] flex-col pl-3"
        style={{ width: `${100 - leftPct}%`, minWidth: 0 }}
      >
        <AgenticCopilotPanel
          onProfileUpdate={handleProfileUpdate}
          onFileForSearch={handleFileForSearch}
          onReadyToProceed={handleReadyToProceed}
        />
      </div>
    </div>
  );
}



function MatchCard({
  item,
  selected,
  onSelect,
  condensed
}: {
  item: MatchItem;
  selected: boolean;
  onSelect: () => void;
  condensed?: boolean;
}) {
  const ringClass = item.score >= 90 ? "border-[var(--mr-action)] text-[var(--mr-action)]" : "border-[var(--mr-border)] text-[var(--mr-text)]";

  if (condensed) {
    return (
      <article
        className={cn(
          "mr-surface flex flex-col gap-3 p-4 transition-all hover:bg-zinc-50 cursor-pointer overflow-hidden group shrink-0",
          selected ? "border-l-[4px] border-l-[var(--mr-action)] bg-blue-50/20" : "border-l-[4px] border-l-transparent"
        )}
        onClick={onSelect}
      >
        <div className="flex items-start justify-between gap-2">
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[3px] bg-white", ringClass)}>
            <span className="text-[13px] font-semibold">{item.score}%</span>
          </div>
          <div className="flex-1 min-w-0 flex justify-end">
            <OutcomeBadge variant={item.outcomeVariant} label={item.outcome} />
          </div>
        </div>
        <div className="space-y-1.5 min-w-0">
          <h3 className="font-semibold text-zinc-900 text-[14px] leading-snug line-clamp-2 group-hover:text-[var(--mr-action)] transition-colors break-words">{item.diagnosis}</h3>
          <p className="text-[12px] leading-relaxed text-zinc-500 line-clamp-2 break-words">{item.summary}</p>
        </div>
        <div className="flex flex-wrap text-[10px] font-medium text-zinc-400 uppercase tracking-wider mt-1 gap-x-2 gap-y-1">
          <span className="truncate max-w-[120px]">{item.facility}</span>
          {item.journal && <span className="truncate max-w-[100px]">• {item.journal}</span>}
          {item.year && <span>• {item.year}</span>}
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "mr-surface flex flex-col gap-4 p-5 lg:h-[132px] lg:flex-row lg:items-center hover:shadow-md transition-all cursor-pointer group shrink-0",
        selected && "border-l-[3px] border-l-[var(--mr-action)] bg-blue-50/10"
      )}
      onClick={onSelect}
    >
      <div className={cn("flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-[3px] bg-white transition-colors group-hover:border-[var(--mr-action)] group-hover:text-[var(--mr-action)]", ringClass)}>
        <span className="text-[17px] font-semibold leading-[22px]">{item.score}%</span>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5 pr-4 py-1">
        <p className="text-[15px] font-semibold leading-[20px] text-zinc-900 group-hover:text-[var(--mr-action)] transition-colors line-clamp-2 break-words">{item.diagnosis}</p>
        <p className="text-[13px] leading-[20px] text-zinc-500 line-clamp-2 break-words">{item.summary}</p>
        <div className="flex flex-wrap text-[11px] text-zinc-400 gap-x-3 gap-y-1 mt-1 font-medium">
          {item.pmc_id && <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {item.pmc_id}</span>}
          {item.year && <span>• {item.year}</span>}
          {item.journal && <span className="truncate max-w-[150px]">• {item.journal}</span>}
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2 lg:items-end">
        <p className="text-[13px] font-medium text-zinc-500 tracking-wide uppercase">{item.facility}</p>
        <OutcomeBadge variant={item.outcomeVariant} label={item.outcome} />
      </div>
    </article>
  );
}

function MatchesScreen({
  selectedMatch,
  onSelectMatch,
  onContinueToRoute,
  items,
  isLoading,
  originalFile,
  originalProfile,
}: {
  selectedMatch: number | null;
  onSelectMatch: (index: number | null) => void;
  onContinueToRoute: () => void;
  items: MatchItem[];
  isLoading: boolean;
  originalFile: File | null;
  originalProfile: CaseProfile | null;
}) {
  const selected = selectedMatch !== null ? items[selectedMatch] : null;

  // Modals state
  const [showTwinProfile, setShowTwinProfile] = useState(false);
  const [showTwinChat, setShowTwinChat] = useState(false);

  // Keep track of which match ID we've loaded insights for
  const [lastInsightsMatchIdx, setLastInsightsMatchIdx] = useState<number | null>(null);

  const originalPreviewUrl = useMemo(() => {
    if (originalFile && originalFile.type.startsWith("image/")) {
      return URL.createObjectURL(originalFile);
    }
    return null;
  }, [originalFile]);

  const [showInsights, setShowInsights] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insights, setInsights] = useState<{
    similarity_text: string;
    original_box: [number, number, number, number];
    match_box: [number, number, number, number];
  } | null>(null);

  // Clear insights if the selected match has changed
  useEffect(() => {
    if (selectedMatch !== lastInsightsMatchIdx) {
      setInsights(null);
      setLastInsightsMatchIdx(selectedMatch);
    }
  }, [selectedMatch, lastInsightsMatchIdx]);

  // Load insights when selected case changes and toggle is active
  useEffect(() => {
    if (selected && originalFile && showInsights && !insights && !insightsLoading) {
      setInsightsLoading(true);
      import("@/lib/mockUploadApis").then((api) => {
        api.compareInsights(originalFile, selected)
          .then((res) => setInsights(res))
          .catch((err) => console.error(err))
          .finally(() => setInsightsLoading(false));
      });
    }
  }, [selected, originalFile, showInsights, insights, insightsLoading]);

  // Handle toggle click
  const handleToggleInsights = () => {
    if (!showInsights) {
      setShowInsights(true);
    } else {
      setShowInsights(false);
    }
  };

  // Helper to render bounding boxes over an image
  const renderBoxOverlay = (box: [number, number, number, number]) => {
    // box is [ymin, xmin, ymax, xmax] max=1000
    const [ymin, xmin, ymax, xmax] = box;
    const top = `${(ymin / 1000) * 100}%`;
    const left = `${(xmin / 1000) * 100}%`;
    const height = `${((ymax - ymin) / 1000) * 100}%`;
    const width = `${((xmax - xmin) / 1000) * 100}%`;

    return (
      <div
        className="absolute border-2 border-[var(--mr-action)] bg-[var(--mr-action)]/20 animate-in fade-in duration-500 rounded-sm"
        style={{ top, left, width, height }}
      >
        <div className="absolute -top-3 -right-3 h-6 w-6 bg-white rounded-full flex items-center justify-center shadow-sm border border-[var(--mr-action)] text-[var(--mr-action)]">
          <Scan className="h-3 w-3" />
        </div>
      </div>
    );
  };

  return (
    <div className={cn(
      "flex h-[calc(100vh-140px)] gap-6",
      selected === null ? "flex-col" : "flex-row"
    )}>
      {/* Left List Container */}
      <div className={cn(
        "flex flex-col gap-5 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]",
        selected === null ? "w-full max-w-[800px] mx-auto opacity-100" : "w-full max-w-[300px] xl:max-w-[380px] shrink-0 opacity-100"
      )}>
        <div className="flex items-center justify-between shrink-0">
          <h1 className={cn("font-semibold text-zinc-900 tracking-tight transition-all", selected === null ? "text-[28px]" : "text-[20px] line-clamp-1")}>
            {selected === null ? "Closest Case Twins" : "Top Matches"}
          </h1>
          {selected === null && (
            <div className="flex items-center gap-2 animate-in fade-in duration-500">
              <select className="mr-select h-9 w-40 text-[14px] leading-5 bg-white">
                <option>Best visual match</option>
                <option>Best outcome</option>
              </select>
              <span className="mr-badge mr-badge--neutral">Top {items.length || 5}</span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-[var(--mr-text-secondary)] bg-zinc-50/50 rounded-2xl border border-dashed border-zinc-200">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--mr-action)]" />
            <p className="text-[15px] font-medium text-zinc-600">Generating MedSiglip embedding and searching cases...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-[var(--mr-text-secondary)] bg-zinc-50/50 rounded-2xl border border-dashed border-zinc-200">
            <p className="text-[15px] font-medium text-zinc-600">No matches found. Upload a chest X-ray image to search.</p>
          </div>
        ) : (
          <div className={cn(
            "overflow-y-auto flex-1 min-h-0 pb-8 pr-2 -mr-2",
            selected === null ? "flex flex-col gap-4" : "flex flex-col gap-3"
          )}>
            {items.map((item, idx) => (
              <MatchCard
                key={`${item.diagnosis}-${item.score}-${idx}`}
                item={item}
                selected={idx === selectedMatch}
                onSelect={() => onSelectMatch(idx === selectedMatch && selected !== null ? null : idx)}
                condensed={selected !== null}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right Detail Container (Big Canvas) */}
      {selected !== null && (
        <div className="flex-1 rounded-2xl border border-zinc-200/80 bg-white shadow-sm flex flex-col overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-right-8 duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]">
          {/* Canvas Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50 px-6 py-4 shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => onSelectMatch(null)}
                className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-zinc-200/80 transition-colors text-zinc-500 hover:text-zinc-900"
                aria-label="Close comparison"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="text-[17px] font-semibold text-zinc-900">In-depth Comparison</h2>
            </div>
            <div className="flex items-center gap-3">
              {/* MedGemma Toggle */}
              <button
                onClick={handleToggleInsights}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-medium transition-all group border",
                  showInsights
                    ? "bg-[var(--mr-action)] text-white border-[var(--mr-action)] shadow-inner"
                    : "bg-white text-zinc-600 border-zinc-200 hover:border-[var(--mr-action)]/30 hover:bg-[var(--mr-action)]/5"
                )}
              >
                <Microscope className={cn("h-4 w-4", showInsights ? "text-white" : "text-[var(--mr-action)]")} />
                {showInsights ? "AI Analysis Active" : "Run AI Analysis"}
              </button>

              <div className="w-px h-5 bg-zinc-200 mx-1" />

              <MedButton variant="secondary" size="sm" onClick={() => setShowTwinProfile(true)}>
                Full Profile
              </MedButton>
              <MedButton variant="primary" size="sm" onClick={onContinueToRoute}>
                Continue to routing
              </MedButton>
            </div>
          </div>

          {/* Canvas Content */}
          <div className="flex-1 overflow-y-auto bg-zinc-50/30 p-6 md:p-8">
            <div className="max-w-[1000px] mx-auto space-y-8 pb-10">

              {/* Dual Image Comparison Banner */}
              <div className="grid grid-flow-row md:grid-cols-2 gap-8 items-stretch pt-2">
                {/* Left: Original */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[15px] font-semibold text-zinc-900 flex items-center gap-2">
                      Your Upload
                      <span className="bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded text-[11px] uppercase tracking-wide">Current</span>
                    </h3>
                  </div>
                  <div className="aspect-[4/3] rounded-2xl border border-zinc-200 overflow-hidden bg-zinc-100 relative shadow-inner">
                    {originalPreviewUrl ? (
                      <>
                        <img
                          src={originalPreviewUrl}
                          alt="Your X-ray"
                          className="w-full h-full object-contain bg-black/5"
                        />
                        {showInsights && !insightsLoading && insights && renderBoxOverlay(insights.original_box)}
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <FileText className="h-10 w-10 text-zinc-300 mb-2" />
                        <p className="text-[13px] text-zinc-500">No original image</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Matched Case */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 className="text-[15px] font-semibold text-zinc-900 flex flex-wrap items-center gap-2">
                      Historical Case Twin
                      <OutcomeBadge variant={selected.outcomeVariant} label={`${selected.score}% Match`} />
                    </h3>
                    <div className="flex gap-2">
                      {/* Buttons moved elsewhere */}
                    </div>
                  </div>
                  <div className="aspect-[4/3] rounded-2xl border border-zinc-200 overflow-hidden bg-zinc-100 relative shadow-inner">
                    {selected.image_url ? (
                      <>
                        <img
                          src={selected.image_url}
                          alt="Matched X-ray"
                          className="w-full h-full object-contain bg-black/5"
                        />
                        {showInsights && !insightsLoading && insights && renderBoxOverlay(insights.match_box)}
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <FileText className="h-10 w-10 text-zinc-300 mb-2" />
                        <p className="text-[13px] text-zinc-500">No image available</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* AI Insights Explanation Panel */}
              {showInsights && (
                <div className="bg-[var(--mr-action)]/5 rounded-2xl border border-[var(--mr-action)]/20 p-5 mt-4 animate-in fade-in slide-in-from-top-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-[var(--mr-action)]/30 text-[var(--mr-action)] shadow-sm">
                      {insightsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Microscope className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 mt-0.5 space-y-1">
                      <h4 className="text-[15px] font-semibold text-zinc-900">MedGemma Concordance Analysis</h4>
                      <p className="text-[14px] leading-relaxed text-zinc-700">
                        {insightsLoading
                          ? "Analyzing dual modalities to highlight structural similarities..."
                          : insights?.similarity_text || selected.summary}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="w-full h-px bg-zinc-200/60" />

              {/* Structural Data Comparison */}
              <div>
                <h3 className="text-[18px] font-semibold text-zinc-900 mb-5">Clinical Comparison Matrix</h3>

                <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
                  <table className="w-full table-fixed text-left border-collapse text-[14px]">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200/80">
                        <th className="py-3 px-4 font-semibold text-zinc-500 uppercase tracking-wider text-xs w-1/4">Clinical Feature</th>
                        <th className="py-3 px-4 font-semibold text-zinc-900 border-l border-zinc-200/80 w-[37.5%]">Your Uploaded Case</th>
                        <th className="py-3 px-4 font-semibold text-zinc-900 border-l border-zinc-200/80 w-[37.5%] flex items-center gap-2">
                          Historical Twin <Check className="h-4 w-4 text-[var(--mr-success)]" />
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">

                      {/* Row 1: Demographics */}
                      <tr className="hover:bg-zinc-50/50 transition-colors">
                        <td className="py-3 px-4 text-zinc-600 font-medium">Demographics</td>
                        <td className="py-3 px-4 border-l border-zinc-200/80">
                          {originalProfile?.patient.age_years ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold mr-2 border border-blue-100">
                              {originalProfile.patient.age_years}y
                            </span>
                          ) : "— "}
                          {originalProfile?.patient.sex ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-100">
                              {originalProfile.patient.sex}
                            </span>
                          ) : ""}
                        </td>
                        <td className="py-3 px-4 border-l border-zinc-200/80">
                          {selected.age ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold mr-2 border border-blue-100">
                              {selected.age}y
                            </span>
                          ) : "— "}
                          {selected.gender ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-100">
                              {selected.gender}
                            </span>
                          ) : ""}
                        </td>
                      </tr>

                      {/* Row 2: Primary Diagnosis/Assessment */}
                      <tr className="hover:bg-zinc-50/50 transition-colors">
                        <td className="py-3 px-4 text-zinc-600 font-medium">Primary Indication</td>
                        <td className="py-3 px-4 border-l border-zinc-200/80 text-zinc-900">
                          {originalProfile?.assessment.diagnosis_primary || "Pending determination"}
                        </td>
                        <td className="py-3 px-4 border-l border-zinc-200/80 text-[var(--mr-action)] font-medium">
                          {selected.diagnosis}
                        </td>
                      </tr>

                      {/* Row 3: Key Findings */}
                      <tr className="hover:bg-zinc-50/50 transition-colors">
                        <td className="py-3 px-4 text-zinc-600 font-medium">Imaging Findings</td>
                        <td className="py-3 px-4 border-l border-zinc-200/80 text-zinc-700">
                          <div className="flex flex-col gap-1 text-[13px]">
                            {originalProfile?.findings.lungs.consolidation_present === "yes" && <span>• Consolidation </span>}
                            {originalProfile?.findings.lungs.edema_present === "yes" && <span>• Edema </span>}
                            {originalProfile?.findings.pleura.effusion_present === "yes" && <span>• Pleural Effusion </span>}
                            {(!originalProfile?.findings.lungs.consolidation_present && !originalProfile?.findings.lungs.edema_present && !originalProfile?.findings.pleura.effusion_present) && <span className="text-zinc-400 italic">No structured findings extracted.</span>}
                          </div>
                        </td>
                        <td className="py-3 px-4 border-l border-zinc-200/80 text-zinc-700">
                          <div className="flex flex-col gap-1 text-[13px]">
                            {selected.raw_payload?.findings?.lungs?.consolidation_present === "yes" && <span>• Lung Consolidation</span>}
                            {selected.raw_payload?.findings?.lungs?.edema_present === "yes" && <span>• Pulmonary Edema</span>}
                            {selected.raw_payload?.findings?.lungs?.atelectasis_present === "yes" && <span>• Atelectasis</span>}
                            {selected.raw_payload?.findings?.pleura?.effusion_present === "yes" && <span>• Pleural Effusion</span>}
                            {selected.raw_payload?.findings?.pleura?.pneumothorax_present === "yes" && <span>• Pneumothorax</span>}
                            {selected.raw_payload?.findings?.cardiomediastinal?.cardiomegaly === "yes" && <span>• Cardiomegaly</span>}
                            {(!selected.raw_payload?.findings || Object.keys(selected.raw_payload.findings).length === 0) && (
                              <span className="text-zinc-400 italic">Review clinical literature</span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Row 4: Evidence Base */}
                      <tr className="hover:bg-zinc-50/50 transition-colors">
                        <td className="py-3 px-4 text-zinc-600 font-medium">Evidence Base</td>
                        <td className="py-3 px-4 border-l border-zinc-200/80 text-zinc-400 text-sm">
                          Active clinical case
                        </td>
                        <td className="py-3 px-4 border-l border-zinc-200/80">
                          <div className="flex flex-col gap-1 text-[13px]">
                            <span className="font-semibold text-zinc-900 break-words line-clamp-2">{selected.article_title || selected.diagnosis}</span>
                            <span className="font-medium text-zinc-600 max-w-full truncate">{selected.facility}</span>
                            <div className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500 mt-1">
                              {selected.pmc_id && (
                                <a href={selected.raw_payload?.provenance?.source_url || `https://www.ncbi.nlm.nih.gov/pmc/articles/${selected.pmc_id}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                                  {selected.pmc_id}
                                </a>
                              )}
                              {selected.journal && <span className="truncate max-w-[120px]">• {selected.journal}</span>}
                              {selected.year && <span>• {selected.year}</span>}
                            </div>
                          </div>
                        </td>
                      </tr>

                    </tbody>
                  </table>
                </div>

              </div>

            </div>
            {/* Chat FAB */}
            <button
              onClick={() => setShowTwinChat(true)}
              className="absolute bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-xl hover:bg-zinc-800 hover:scale-105 active:scale-95 transition-all z-10"
              aria-label="Open clinical chat context"
            >
              <Activity className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}

      {/* Render Twin Modals */}
      <TwinProfileModal
        isOpen={showTwinProfile}
        onClose={() => setShowTwinProfile(false)}
        match={selected}
      />
      <TwinChatPanel
        isOpen={showTwinChat}
        onClose={() => setShowTwinChat(false)}
        match={selected}
      />
    </div>
  );
}

function CenterRow({ center }: { center: RouteCenter }) {
  return (
    <div className="flex min-h-16 flex-col gap-2 border-b border-[var(--mr-border)] px-4 py-3 text-[15px] leading-[22px] last:border-b-0 lg:grid lg:grid-cols-[260px_120px_100px_1fr] lg:items-center lg:gap-4">
      <p className="font-semibold text-[var(--mr-text)]">{center.name}</p>
      <div className="flex items-center gap-2">
        <span className="text-[var(--mr-text)]">{center.capability}</span>
        <span className="h-1.5 w-16 rounded bg-[var(--mr-bg-subtle)]">
          <span className="block h-1.5 rounded bg-[var(--mr-action)]" style={{ width: center.capability }} />
        </span>
      </div>
      <p className="text-[var(--mr-text)]">{center.travel}</p>
      <p className="text-[var(--mr-text)]">{center.reason}</p>
    </div>
  );
}

function RouteScreen({
  equipment,
  maxTravelTime,
  language,
  onEquipmentToggle,
  onMaxTravelTimeChange,
  onLanguageChange
}: {
  equipment: Record<string, boolean>;
  maxTravelTime: number;
  language: string;
  onEquipmentToggle: (key: string, value: boolean) => void;
  onMaxTravelTimeChange: (value: number) => void;
  onLanguageChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[680px_416px]">
      <div className="space-y-4">
        <SurfaceCard className="h-80 relative overflow-hidden p-0 border-zinc-200">
          <div className="absolute inset-0 bg-[#F3F4F6]">
            <MapPin className="absolute left-[20%] top-[28%] h-5 w-5 text-[var(--mr-text)]" />
            <MapPin className="absolute left-[46%] top-[42%] h-5 w-5 text-[var(--mr-text)]" />
            <MapPin className="absolute left-[72%] top-[34%] h-5 w-5 text-[var(--mr-text)]" />
            <span className="absolute bottom-3 left-3 rounded-full bg-white px-3 py-1 text-xs leading-4 text-[var(--mr-text-secondary)]">
              Travel time estimates are simulated for demo.
            </span>
          </div>
        </SurfaceCard>

        <SurfaceCard className="gap-0 p-0">
          {routeCenters.map((center) => (
            <CenterRow key={center.name} center={center} />
          ))}
        </SurfaceCard>
      </div>

      <div className="space-y-4">
        <SurfaceCard>
          <h2 className="text-[17px] font-semibold leading-[22px] text-[var(--mr-text)]">Filters</h2>

          <div className="space-y-2">
            <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Required equipment</p>
            <div className="space-y-2">
              {Object.entries(equipment).map(([name, checked]) => (
                <LabeledCheckbox
                  key={name}
                  checked={checked}
                  label={name}
                  onChange={(next) => onEquipmentToggle(name, next)}
                />
              ))}
            </div>
          </div>

          <div className="mr-divider" />

          <div className="space-y-2">
            <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Max travel time</p>
            <input
              type="range"
              min={0}
              max={6}
              step={0.5}
              className="mr-slider"
              value={maxTravelTime}
              onChange={(event) => onMaxTravelTimeChange(Number(event.target.value))}
            />
            <div className="flex items-center justify-between text-xs leading-4 text-[var(--mr-text-secondary)]">
              <span>0h</span>
              <span>6h</span>
            </div>
          </div>

          <div className="mr-divider" />

          <div className="space-y-1">
            <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Language preference</p>
            <select
              className="mr-select h-9 text-[14px] leading-5"
              value={language}
              onChange={(event) => onLanguageChange(event.target.value)}
            >
              <option>English</option>
            </select>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}

function MemoScreen() {
  return (
    <div className="grid gap-6 lg:grid-cols-[680px_416px]">
      <div className="space-y-4">
        <SurfaceCard className="gap-4 p-8">
          <div className="space-y-1">
            <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.01em] text-[var(--mr-text)]">
              Transfer Memo
            </h1>
            <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Generated by MedRoute AI</p>
          </div>

          <div className="mr-divider" />

          <section className="space-y-1">
            <h2 className="text-[17px] font-semibold leading-[22px] text-[var(--mr-text)]">Reason for transfer</h2>
            <p className="text-[15px] leading-[22px] text-[var(--mr-text)]">
              Higher-acuity diagnostic workup and definitive management of a suspected right hilar
              lung malignancy.
            </p>
          </section>

          <section className="space-y-1">
            <h2 className="text-[17px] font-semibold leading-[22px] text-[var(--mr-text)]">Case summary</h2>
            <p className="text-[15px] leading-[22px] text-[var(--mr-text)]">
              52-year-old presenting with hemoptysis and unintentional weight loss. CT chest
              reveals a right hilar mass with mediastinal lymphadenopathy. No prior history of
              malignancy.
            </p>
          </section>

          <section className="space-y-1">
            <h2 className="text-[17px] font-semibold leading-[22px] text-[var(--mr-text)]">Matched precedent</h2>
            <p className="text-[15px] leading-[22px] text-[var(--mr-text)]">
              94% clinical similarity to a 2024 case at Mayo Clinic — Rochester resulting in
              complete response after concurrent chemoradiation therapy.
            </p>
          </section>

          <section className="space-y-1">
            <h2 className="text-[17px] font-semibold leading-[22px] text-[var(--mr-text)]">
              Recommended next steps
            </h2>
            <ol className="list-decimal space-y-1 pl-5 text-[15px] leading-[22px] text-[var(--mr-text)]">
              <li>Bronchoscopy with endobronchial biopsy</li>
              <li>Staging PET-CT scan</li>
              <li>Thoracic oncology consultation</li>
              <li>Multidisciplinary tumor board review</li>
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="text-[17px] font-semibold leading-[22px] text-[var(--mr-text)]">Attachments</h2>
            <div className="flex items-center gap-2 text-[15px] leading-[22px] text-[var(--mr-text)]">
              <FileText className="h-4 w-4 text-[var(--mr-text-secondary)]" />
              <span>CT_Chest_Scan_001.dcm — Original imaging</span>
            </div>
            <div className="flex items-center gap-2 text-[15px] leading-[22px] text-[var(--mr-text)]">
              <FileText className="h-4 w-4 text-[var(--mr-text-secondary)]" />
              <span>FHIR_Bundle.json — Structured clinical data</span>
            </div>
          </section>
        </SurfaceCard>
      </div>

      <div className="space-y-4">
        <SurfaceCard>
          <h2 className="text-[17px] font-semibold leading-[22px] text-[var(--mr-text)]">Export</h2>
          <MedButton variant="primary" fullWidth>
            Download PDF
          </MedButton>
          <MedButton variant="secondary" fullWidth>
            Copy text
          </MedButton>
          <MedButton variant="secondary" fullWidth>
            Generate in another language
          </MedButton>
        </SurfaceCard>

        <p className="pt-1 text-xs leading-4 text-[var(--mr-text-secondary)]">
          Decision support only. Final clinical decisions remain with the care team.
        </p>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [step, setStep] = useState<Step>(0);
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null);
  const [deIdentify, setDeIdentify] = useState(true);
  const [saveToHistory, setSaveToHistory] = useState(true);
  const [maxTravelTime, setMaxTravelTime] = useState(3);
  const [language, setLanguage] = useState("English");
  const [equipment, setEquipment] = useState<Record<string, boolean>>({
    "Interventional radiology": true,
    "Robotic surgery": false,
    "Pediatric ICU": false,
    "3T MRI": true
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [matchResults, setMatchResults] = useState<MatchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleStepChange = async (next: Step) => {
    // When advancing to the Matches step (1), trigger real search
    if (next === 1 && matchResults.length === 0) {
      setStep(next);
      setIsSearching(true);
      setSearchError(null);
      try {
        let fileToSearch = uploadedFile;
        if (!fileToSearch) {
          // Fallback dummy 1x1 image so backend receives a valid file
          const dummyImg = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 11, 73, 68, 65, 84, 8, 153, 99, 248, 15, 4, 0, 9, 251, 3, 253, 153, 226, 18, 172, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130])], { type: 'image/png' });
          fileToSearch = new File([dummyImg], "dummy.png", { type: "image/png" });
        }

        const profileData = useDashboardStore.getState().profile;
        const results = await searchByImage(fileToSearch, profileData || undefined);
        console.log("FULL MATCHED DATA:", results);
        setMatchResults(results);
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setIsSearching(false);
      }
    } else {
      setStep(next);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-[var(--mr-page)] text-[var(--mr-text)]">
      <header className="fixed left-0 right-0 top-0 z-40 border-b border-zinc-200/80 bg-white/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
        <div className="mr-container flex h-16 items-center justify-between gap-4 py-3">

          <div className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity">
            <div className="flex h-8 w-8 items-center justify-center rounded-[0.4rem] bg-gradient-to-tr from-zinc-900 to-zinc-800 text-white shadow-[0_1px_3px_rgba(0,0,0,0.1)] ring-1 ring-zinc-900/10 transition-transform duration-300 hover:scale-[1.03]">
              <span className="text-[13px] font-bold tracking-wider">CT</span>
            </div>
            <span className="text-[16px] font-semibold tracking-tight text-zinc-900">Case-Twin</span>
          </div>

          <div className="flex-1 flex justify-center">
            <Stepper step={step} onStepChange={handleStepChange} />
          </div>

          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50">
              <FolderOpen className="w-3.5 h-3.5" strokeWidth={2.5} /> My Cases
            </button>

            <button className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-1.5 text-[13px] font-medium text-white shadow-md shadow-zinc-900/10 hover:bg-zinc-800 transition-all active:scale-[0.98]">
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              New Case
            </button>

            <div className="w-px h-4 bg-zinc-200" />

            <button aria-label="Settings" className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors">
              <Settings2 className="h-4 w-4" />
            </button>
          </div>

        </div>
      </header>

      <main
        className={cn("mr-container h-full pb-6 pt-24", step === 0 ? "overflow-hidden" : "overflow-auto")}
      >
        {step === 0 ? (
          <UploadScreen
            deIdentify={deIdentify}
            saveToHistory={saveToHistory}
            onDeIdentifyChange={setDeIdentify}
            onSaveHistoryChange={setSaveToHistory}
            onImageFilePicked={setUploadedFile}
            onStepChange={handleStepChange}
          />
        ) : null}

        {step === 1 ? (
          <>
            {searchError && (
              <div className="mb-6 rounded-2xl border border-red-200/80 bg-red-50/50 p-4 shadow-sm backdrop-blur-md max-w-2xl mx-auto">
                <div className="flex gap-3.5 items-start">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100/80 text-red-600 shadow-sm border border-red-200">
                    <CloudOff className="h-4 w-4" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 mt-0.5">
                    <h3 className="text-[14px] font-semibold text-red-900 tracking-tight">Search Unavailable</h3>
                    <p className="mt-1 text-[13px] text-red-700 leading-relaxed font-medium">{searchError}</p>
                  </div>
                </div>
              </div>
            )}
            <MatchesScreen
              selectedMatch={selectedMatch}
              onSelectMatch={setSelectedMatch}
              onContinueToRoute={() => setStep(2)}
              items={matchResults}
              isLoading={isSearching}
              originalFile={uploadedFile}
              originalProfile={useDashboardStore.getState().profile}
            />
          </>
        ) : null}

        {step === 2 ? (
          <RouteScreen
            equipment={equipment}
            maxTravelTime={maxTravelTime}
            language={language}
            onEquipmentToggle={(key, value) =>
              setEquipment((current) => ({
                ...current,
                [key]: value
              }))
            }
            onMaxTravelTimeChange={setMaxTravelTime}
            onLanguageChange={setLanguage}
          />
        ) : null}

        {step === 3 ? <MemoScreen /> : null}
      </main>
    </div>
  );
}
