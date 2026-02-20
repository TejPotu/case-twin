import { useCallback, useRef, useState, useMemo, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Check, FileText, Loader2, MapPin, Settings, Sparkles } from "lucide-react";
import { searchByImage, type MatchItem as ApiMatchItem } from "@/lib/mockUploadApis";
import { computeProfileConfidence } from "@/lib/caseProfileUtils";
import { type CaseProfile } from "@/lib/caseProfileTypes";
import { CaseProfileView } from "@/components/CaseProfileView";
import { AgenticCopilotPanel } from "@/components/AgenticCopilotPanel";
import { cn } from "@/lib/utils";


type Step = 0 | 1 | 2 | 3 | 4;
type OutcomeVariant = "success" | "warning" | "neutral";

interface MatchItem {
  score: number;
  diagnosis: string;
  summary: string;
  facility: string;
  outcome: string;
  outcomeVariant: OutcomeVariant;
  image_url?: string;
  age?: number;
  gender?: string;
  pmc_id?: string;
  article_title?: string;
  case_text?: string;
  radiology_view?: string;
}

interface RouteCenter {
  name: string;
  capability: string;
  travel: string;
  reason: string;
}

const stepLabels = ["Upload", "Review", "Matches", "Route", "Memo"] as const;

const reviewFields = [
  { label: "Age", value: "52" },
  { label: "Sex", value: "Not specified" },
  { label: "Primary concern", value: "Hemoptysis, weight loss" },
  { label: "Suspected condition", value: "Possible lung malignancy" },
  { label: "Modality", value: "CT Chest" },
  { label: "Key findings", value: "Right hilar mass, mediastinal LAD" }
];

const matchItems: MatchItem[] = [
  {
    score: 94,
    diagnosis: "Small cell lung carcinoma",
    summary: "Imaging pattern matches right hilar mass",
    facility: "Mayo Clinic — Rochester",
    outcome: "Complete response",
    outcomeVariant: "success"
  },
  {
    score: 91,
    diagnosis: "NSCLC (adenocarcinoma)",
    summary: "Pattern overlap with central chest lesion",
    facility: "Cleveland Clinic",
    outcome: "Partial response",
    outcomeVariant: "warning"
  },
  {
    score: 89,
    diagnosis: "Pulmonary carcinoid tumor",
    summary: "Strong imaging and symptom similarity",
    facility: "Mass General",
    outcome: "Good recovery",
    outcomeVariant: "success"
  },
  {
    score: 86,
    diagnosis: "Lymphoma (mediastinal)",
    summary: "Clinical features partially align",
    facility: "Johns Hopkins",
    outcome: "Remission",
    outcomeVariant: "success"
  },
  {
    score: 84,
    diagnosis: "Granulomatous disease",
    summary: "Differential match with lower confidence",
    facility: "UCSF",
    outcome: "Resolved",
    outcomeVariant: "neutral"
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
        "mr-badge",
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
  const [profile, setProfile] = useState<CaseProfile | null>(null);

  const conf = profile ? computeProfileConfidence(profile) : { score: 0, filled: 0, total: 13, missing: [] };

  const handleProfileUpdate = useCallback((updated: CaseProfile) => {
    setProfile(updated);
  }, []);

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
      className="flex h-full min-h-[calc(100vh-120px)] gap-0"
      style={{ overflow: "hidden" }}
    >
      {/* ── Left: Live Case Profile ── */}
      <div
        className="flex flex-col gap-4 overflow-y-auto pr-3"
        style={{ width: `${leftPct}%`, minWidth: 0 }}
      >
        {/* Uploaded image preview */}
        {profile?.study.image_url && (
          <SurfaceCard>
            <p className="mr-label mb-2">Uploaded Imaging</p>
            <div className="overflow-hidden rounded-xl border border-[var(--mr-border)] bg-[var(--mr-bg-subtle)]">
              <img
                src={profile.study.image_url}
                alt="Uploaded imaging study"
                className="w-full object-contain"
                style={{ maxHeight: "220px" }}
              />
            </div>
            {profile.study.modality && (
              <p className="mt-2 text-xs text-[var(--mr-text-secondary)]">
                {profile.study.modality}{profile.study.body_region ? ` · ${profile.study.body_region}` : ""}
              </p>
            )}
          </SurfaceCard>
        )}

        {/* Confidence summary card */}
        <SurfaceCard label="Case card" title="Case Profile">
          <div className="flex items-center gap-5 pb-2">
            {/* Ring */}
            <div className="relative h-20 w-20 shrink-0">
              <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--mr-border)" strokeWidth="6" />
                <circle
                  cx="40" cy="40" r="34" fill="none"
                  stroke={
                    conf.score >= 80 ? "var(--mr-success)"
                      : conf.score >= 50 ? "var(--mr-warning)"
                        : "var(--mr-action)"
                  }
                  strokeWidth="6"
                  strokeDasharray={`${(conf.score / 100) * 213.6} 213.6`}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold leading-none text-[var(--mr-text)]">{conf.score}%</span>
                <span className="text-[10px] font-medium text-[var(--mr-text-secondary)]">confidence</span>
              </div>
            </div>
            {/* Stats */}
            <div>
              <p className="text-sm font-semibold text-[var(--mr-text)]">
                {conf.score >= 80 ? "High completeness" : conf.score >= 50 ? "Moderate completeness" : "Low completeness"}
              </p>
              <p className="mt-0.5 text-xs text-[var(--mr-text-secondary)]">
                {conf.filled} of {conf.total} fields captured
              </p>
              {conf.missing.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {conf.missing.slice(0, 4).map(m => (
                    <span key={m} className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
                      {m}
                    </span>
                  ))}
                  {conf.missing.length > 4 && (
                    <span className="rounded-full bg-[var(--mr-bg-subtle)] px-2 py-0.5 text-[10px] text-[var(--mr-text-secondary)]">
                      +{conf.missing.length - 4} more
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </SurfaceCard>

        {/* Live profile fields */}
        {profile ? (
          <CaseProfileView profile={profile} />
        ) : (
          <SurfaceCard>
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--mr-bg-subtle)]">
                <Sparkles className="h-7 w-7 text-[var(--mr-text-secondary)]" />
              </div>
              <p className="text-sm font-medium text-[var(--mr-text-secondary)]">No profile yet</p>
              <p className="max-w-[220px] text-xs leading-5 text-[var(--mr-text-secondary)]">
                Talk to the Copilot — share evidence and watch the case profile appear here.
              </p>
            </div>
          </SurfaceCard>
        )}
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


function ReviewScreen({
  tab,
  onTabChange
}: {
  tab: "readable" | "json";
  onTabChange: (next: "readable" | "json") => void;
}) {
  const fhirJson = useMemo(
    () =>
      JSON.stringify(
        {
          conditions: ["Possible lung neoplasm"],
          observations: ["Hemoptysis"],
          imaging: ["CT", "Chest"]
        },
        null,
        2
      ),
    []
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[680px_416px]">
      <div className="space-y-4">
        <SurfaceCard>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-semibold leading-[22px] text-[var(--mr-text)]">Extracted details</h2>
            <MedButton variant="tertiary">Edit</MedButton>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {reviewFields.map((entry) => (
              <div key={entry.label} className="space-y-0.5">
                <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">{entry.label}</p>
                <p className="text-[15px] leading-[22px] text-[var(--mr-text)]">{entry.value}</p>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <div className="flex items-center border-b border-[var(--mr-border)]">
            <button
              type="button"
              className={cn(
                "h-10 border-b-2 px-3 text-[15px] leading-[22px]",
                tab === "readable"
                  ? "border-[var(--mr-text)] text-[var(--mr-text)]"
                  : "border-transparent text-[var(--mr-text-secondary)]"
              )}
              onClick={() => onTabChange("readable")}
            >
              Readable
            </button>
            <button
              type="button"
              className={cn(
                "h-10 border-b-2 px-3 text-[15px] leading-[22px]",
                tab === "json"
                  ? "border-[var(--mr-text)] text-[var(--mr-text)]"
                  : "border-transparent text-[var(--mr-text-secondary)]"
              )}
              onClick={() => onTabChange("json")}
            >
              FHIR JSON
            </button>
          </div>

          {tab === "readable" ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Conditions</p>
                <p className="text-[15px] leading-[22px] text-[var(--mr-text)]">Possible lung neoplasm</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Observations</p>
                <p className="text-[15px] leading-[22px] text-[var(--mr-text)]">Hemoptysis</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Imaging</p>
                <p className="text-[15px] leading-[22px] text-[var(--mr-text)]">CT, Chest</p>
              </div>
            </div>
          ) : (
            <pre className="max-h-[220px] overflow-auto rounded-xl bg-[var(--mr-bg-subtle)] p-3 text-xs leading-4 text-[var(--mr-text)]">
              {fhirJson}
            </pre>
          )}
        </SurfaceCard>
      </div>

      <div className="space-y-4">
        <SurfaceCard>
          <h2 className="text-[17px] font-semibold leading-[22px] text-[var(--mr-text)]">Extraction quality</h2>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[15px] leading-[22px]">
              <span className="text-[var(--mr-text)]">Completeness</span>
              <span className="font-semibold text-[var(--mr-text)]">92%</span>
            </div>
            <div className="h-1 rounded bg-[#DCFCE7]">
              <div className="h-full w-[92%] rounded bg-[var(--mr-success)]" />
            </div>
          </div>

          <div className="flex items-center justify-between text-[15px] leading-[22px]">
            <span className="text-[var(--mr-text)]">Ambiguities</span>
            <span className="font-semibold text-[var(--mr-text)]">2</span>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-[#FFFBEB] p-3">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#FDE68A] text-xs text-[var(--mr-warning)]">
              !
            </span>
            <p className="text-xs leading-4 text-[var(--mr-warning)]">Smoking history not found.</p>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}

function MatchCard({
  item,
  selected,
  onSelect
}: {
  item: MatchItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const ringClass = item.score >= 90 ? "border-[var(--mr-action)]" : "border-[var(--mr-border)]";

  return (
    <article
      className={cn(
        "mr-surface flex flex-col gap-4 p-5 lg:h-[132px] lg:flex-row lg:items-center",
        selected && "border-l-[3px] border-l-[var(--mr-action)]"
      )}
    >
      <div className={cn("flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-[3px]", ringClass)}>
        <span className="text-[17px] font-semibold leading-[22px] text-[var(--mr-text)]">{item.score}%</span>
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-[15px] font-semibold leading-[22px] text-[var(--mr-text)]">{item.diagnosis}</p>
        <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">{item.summary}</p>
      </div>

      <div className="flex shrink-0 flex-col gap-2 lg:items-end">
        <p className="text-xs leading-4 text-[var(--mr-text)]">{item.facility}</p>
        <OutcomeBadge variant={item.outcomeVariant} label={item.outcome} />
        <MedButton variant="secondary" size="sm" onClick={onSelect}>
          Select
        </MedButton>
      </div>
    </article>
  );
}

function MatchesScreen({
  selectedMatch,
  onSelectMatch,
  onContinueToRoute,
  items,
  isLoading
}: {
  selectedMatch: number;
  onSelectMatch: (index: number) => void;
  onContinueToRoute: () => void;
  items: MatchItem[];
  isLoading: boolean;
}) {
  const selected = items[selectedMatch];

  return (
    <div className="grid gap-6 lg:grid-cols-[680px_416px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.01em] text-[var(--mr-text)]">
            Closest Case Twins
          </h1>
          <div className="flex items-center gap-2">
            <select className="mr-select h-9 w-40 text-[14px] leading-5">
              <option>Best outcome</option>
            </select>
            <span className="mr-badge mr-badge--neutral">Top {items.length || 5}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--mr-text-secondary)]">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Generating MedSiglip embedding and searching cases...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-[var(--mr-text-secondary)]">
            <p className="text-sm">No matches found. Upload a chest X-ray image to search.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => (
              <MatchCard
                key={`${item.diagnosis}-${item.score}-${idx}`}
                item={item}
                selected={idx === selectedMatch}
                onSelect={() => onSelectMatch(idx)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <SurfaceCard>
          <h2 className="text-[17px] font-semibold leading-[22px] text-[var(--mr-text)]">Why this match</h2>
          {selected ? (
            <>
              <ul className="space-y-2 text-[15px] leading-[22px] text-[var(--mr-text)]">
                <li>Visual similarity score: <strong>{selected.score}%</strong></li>
                {selected.age != null && <li>Patient: {selected.age}y {selected.gender ?? ""}</li>}
                {selected.radiology_view && <li>View: {selected.radiology_view}</li>}
              </ul>

              {selected.image_url && (
                <img
                  src={selected.image_url}
                  alt="Matched X-ray"
                  className="mt-2 w-full rounded-xl object-cover"
                  style={{ maxHeight: 200 }}
                />
              )}

              <div className="mr-divider" />

              <div className="space-y-1">
                <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Case summary</p>
                <p className="text-[15px] leading-[22px] text-[var(--mr-text)]">
                  {selected.case_text ? selected.case_text.slice(0, 200) + "..." : selected.summary}
                </p>
              </div>
            </>
          ) : (
            <p className="text-[15px] leading-[22px] text-[var(--mr-text-secondary)]">
              Select a match to see details.
            </p>
          )}

          <MedButton variant="primary" fullWidth onClick={onContinueToRoute} disabled={items.length === 0}>
            Continue to routing
          </MedButton>
        </SurfaceCard>
      </div>
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
        <SurfaceCard className="h-80">
          <div className="relative h-full rounded-xl bg-[#F3F4F6]">
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
        <SurfaceCard className="gap-4 p-8 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
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
  const [reviewTab, setReviewTab] = useState<"readable" | "json">("readable");
  const [selectedMatch, setSelectedMatch] = useState(0);
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
    // When advancing to the Matches step (2), trigger real search
    if (next === 2 && uploadedFile && matchResults.length === 0) {
      setStep(next);
      setIsSearching(true);
      setSearchError(null);
      try {
        const results = await searchByImage(uploadedFile);
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
      <header className="fixed left-0 right-0 top-0 z-40 border-b border-[var(--mr-border)] bg-white/95 shadow-[0_6px_20px_rgba(0,0,0,0.04)] backdrop-blur">
        <div className="mr-container flex min-h-24 flex-col justify-center gap-2 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold leading-[22px] text-[var(--mr-text)]">MedRoute</span>
              <span className="text-xs leading-4 text-[var(--mr-text-secondary)]">Case-Twin Routing</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-full border border-[var(--mr-border)] px-4 text-[14px] font-medium leading-5 text-[var(--mr-text)] transition hover:bg-[var(--mr-bg-subtle)]"
              >
                Case History
              </button>
              <button
                type="button"
                aria-label="Settings"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--mr-border)] text-[var(--mr-text-secondary)] transition hover:bg-[var(--mr-bg-subtle)]"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <Stepper step={step} onStepChange={handleStepChange} />
          </div>
        </div>
      </header>

      <main
        className={cn("mr-container h-full pb-6 pt-32", step === 0 ? "overflow-hidden" : "overflow-auto")}
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

        {step === 1 ? <ReviewScreen tab={reviewTab} onTabChange={setReviewTab} /> : null}

        {step === 2 ? (
          <>
            {searchError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                ⚠️ {searchError} — Make sure the backend is running at localhost:8000.
              </div>
            )}
            <MatchesScreen
              selectedMatch={selectedMatch}
              onSelectMatch={setSelectedMatch}
              onContinueToRoute={() => setStep(3)}
              items={matchResults}
              isLoading={isSearching}
            />
          </>
        ) : null}

        {step === 3 ? (
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

        {step === 4 ? <MemoScreen /> : null}
      </main>
    </div>
  );
}
