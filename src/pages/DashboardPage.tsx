import { useMemo, useState, type ButtonHTMLAttributes } from "react";
import { Check, FileText, MapPin, Settings, UploadCloud } from "lucide-react";
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

function SurfaceCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("mr-surface", className)}>{children}</section>;
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

function Stepper({ step }: { step: Step }) {
  return (
    <ol className="flex flex-wrap items-center justify-center gap-2">
      {stepLabels.map((label, idx) => {
        const state = idx < step ? "done" : idx === step ? "active" : "default";

        return (
          <li
            key={label}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-4 text-xs leading-4",
              state === "default" && "bg-transparent text-[var(--mr-text-secondary)]",
              state === "active" && "bg-[var(--mr-action)] font-semibold text-[var(--mr-on-action)]",
              state === "done" && "bg-[var(--mr-bg-subtle)] text-[var(--mr-text)]"
            )}
          >
            {state === "done" ? <Check className="h-3 w-3" /> : null}
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function UploadScreen({
  deIdentify,
  saveToHistory,
  onDeIdentifyChange,
  onSaveHistoryChange
}: {
  deIdentify: boolean;
  saveToHistory: boolean;
  onDeIdentifyChange: (next: boolean) => void;
  onSaveHistoryChange: (next: boolean) => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[680px_416px]">
      <div className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.01em] text-[var(--mr-text)]">
            New case
          </h1>
          <p className="text-[15px] leading-[22px] text-[var(--mr-text-secondary)]">
            Add imaging and a short note. We will structure it and find the closest Case Twins.
          </p>
        </div>

        <SurfaceCard>
          <div className="mx-auto flex min-h-[180px] w-full max-w-[640px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--mr-border)] bg-[var(--mr-bg-subtle)] px-4 py-6 text-center">
            <UploadCloud className="h-8 w-8 text-[var(--mr-text-secondary)]" />
            <p className="text-[15px] leading-[22px] text-[var(--mr-text)]">Drop DICOM or image here</p>
            <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">
              DICOM (.dcm), JPG, PNG up to 50 MB
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
              <MedButton variant="secondary" size="sm">
                Browse files
              </MedButton>
              <MedButton variant="tertiary" size="sm">
                Import from PACS (Beta)
              </MedButton>
            </div>
          </div>

          <div className="mr-divider" />

          <div className="flex items-center justify-between gap-3">
            <p className="text-[15px] leading-[22px] text-[var(--mr-text)]">Capture from phone</p>
            <MedButton variant="secondary" size="sm">
              Show QR
            </MedButton>
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <div className="space-y-1">
            <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Clinical note</p>
            <textarea
              className="mr-textarea"
              defaultValue=""
              placeholder="52-year-old with hemoptysis and weight loss. CT shows right hilar mass and mediastinal lymphadenopathy. No known prior malignancy."
            />
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
            <LabeledCheckbox
              checked={deIdentify}
              label="De-identify on upload"
              onChange={onDeIdentifyChange}
            />
            <LabeledCheckbox
              checked={saveToHistory}
              label="Save to Case History"
              onChange={onSaveHistoryChange}
            />
          </div>
        </SurfaceCard>
      </div>

      <div className="space-y-4">
        <SurfaceCard>
          <h2 className="text-[17px] font-semibold leading-[22px] text-[var(--mr-text)]">What happens next</h2>
          <ol className="space-y-2">
            {[
              "Extract a clean clinical summary (FHIR-ready).",
              "Generate a case embedding.",
              "Find top matches with outcomes.",
              "Recommend best-capability centers.",
              "Generate a transfer memo."
            ].map((item, idx) => (
              <li key={item} className="flex items-start gap-2">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--mr-bg-subtle)] text-xs leading-4 text-[var(--mr-text)]">
                  {idx + 1}
                </span>
                <span className="text-[15px] leading-[22px] text-[var(--mr-text)]">{item}</span>
              </li>
            ))}
          </ol>
        </SurfaceCard>

        <SurfaceCard className="border-dashed">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[var(--mr-text-secondary)]" />
            <p className="text-[15px] font-semibold leading-[22px] text-[var(--mr-text)]">CT_Chest_Scan_001.dcm</p>
          </div>
          <p className="text-xs leading-4 text-[var(--mr-text)]">Modality: CT</p>
          <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Uploaded: Just now</p>
        </SurfaceCard>
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
            <span className="text-sm text-[var(--mr-warning)]">⚠</span>
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
  onContinueToRoute
}: {
  selectedMatch: number;
  onSelectMatch: (index: number) => void;
  onContinueToRoute: () => void;
}) {
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
            <span className="mr-badge mr-badge--neutral">Top 5</span>
          </div>
        </div>

        <div className="space-y-3">
          {matchItems.map((item, idx) => (
            <MatchCard
              key={`${item.diagnosis}-${item.score}`}
              item={item}
              selected={idx === selectedMatch}
              onSelect={() => onSelectMatch(idx)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <SurfaceCard>
          <h2 className="text-[17px] font-semibold leading-[22px] text-[var(--mr-text)]">Why this match</h2>
          <ul className="space-y-2 text-[15px] leading-[22px] text-[var(--mr-text)]">
            <li>Imaging pattern aligns with right hilar mass presentation.</li>
            <li>Similar patient demographics and clinical history.</li>
            <li>Outcome-weighted ranking favors complete response cases.</li>
          </ul>

          <div className="mr-divider" />

          <div className="space-y-1">
            <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Outcome notes</p>
            <p className="text-[15px] leading-[22px] text-[var(--mr-text)]">
              Complete response after chemoradiation, 18-month follow-up.
            </p>
          </div>

          <MedButton variant="primary" fullWidth onClick={onContinueToRoute}>
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

  const helperText = step === 1 ? "Review the extraction before searching." : "";
  const primaryLabel =
    step === 0
      ? "Continue"
      : step === 1
        ? "Looks good, continue"
        : step === 2
          ? "Continue"
          : step === 3
            ? "Generate transfer memo"
            : null;

  const advance = () =>
    setStep((current) => {
      if (current >= 4) {
        return current;
      }
      return (current + 1) as Step;
    });

  const goBack = () =>
    setStep((current) => {
      if (current <= 0) {
        return current;
      }
      return (current - 1) as Step;
    });

  return (
    <div className="min-h-screen bg-[var(--mr-page)] text-[var(--mr-text)]">
      <header className="fixed left-0 right-0 top-0 z-40 h-16 border-b border-[var(--mr-border)] bg-white">
        <div className="mr-container flex h-full items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold leading-[22px] text-[var(--mr-text)]">MedRoute</span>
            <span className="text-xs leading-4 text-[var(--mr-text-secondary)]">Case-Twin Routing</span>
          </div>

          <div className="flex items-center gap-4">
            <button type="button" className="text-[15px] leading-[22px] text-[var(--mr-text)]">
              Case History
            </button>
            <button
              type="button"
              aria-label="Settings"
              className="inline-flex h-5 w-5 items-center justify-center text-[var(--mr-text-secondary)]"
            >
              <Settings className="h-5 w-5" />
            </button>
            <span className="inline-flex h-6 items-center gap-2 rounded-full bg-[var(--mr-bg-subtle)] px-2.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--mr-success)]" />
              <span className="text-xs leading-4 text-[var(--mr-text)]">Demo Mode</span>
            </span>
          </div>
        </div>
      </header>

      <div className="fixed left-0 right-0 top-16 z-30 h-14 bg-white">
        <div className="mr-container flex h-full items-center justify-center">
          <Stepper step={step} />
        </div>
      </div>

      <main className="mr-container pb-28 pt-36">
        {step === 0 ? (
          <UploadScreen
            deIdentify={deIdentify}
            saveToHistory={saveToHistory}
            onDeIdentifyChange={setDeIdentify}
            onSaveHistoryChange={setSaveToHistory}
          />
        ) : null}

        {step === 1 ? <ReviewScreen tab={reviewTab} onTabChange={setReviewTab} /> : null}

        {step === 2 ? (
          <MatchesScreen
            selectedMatch={selectedMatch}
            onSelectMatch={setSelectedMatch}
            onContinueToRoute={() => setStep(3)}
          />
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

      <footer className="fixed bottom-0 left-0 right-0 z-40 h-[72px] border-t border-[var(--mr-border)] bg-white">
        <div className="mr-container flex h-full items-center justify-between gap-3">
          <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">{helperText}</p>
          <div className="flex items-center gap-3">
            {step > 0 ? (
              <MedButton variant="secondary" onClick={goBack}>
                Back
              </MedButton>
            ) : null}
            {primaryLabel ? (
              <MedButton variant="primary" onClick={advance}>
                {primaryLabel}
              </MedButton>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
