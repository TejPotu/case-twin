import { useMemo, useRef, useState, type ButtonHTMLAttributes } from "react";
import { Bot, Check, FileText, Loader2, MapPin, SendHorizontal, Settings, Sparkles, UploadCloud } from "lucide-react";
import {
  computeCaseCompletion,
  emptyCaseCardDraft,
  mockAnalyzeClinicalNote,
  mockIngestImagingFile,
  mockRespondToAgent,
  type CaseCardDraft
} from "@/lib/mockUploadApis";
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
  const imagingInputRef = useRef<HTMLInputElement | null>(null);
  const notesFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [draft, setDraft] = useState<CaseCardDraft>(emptyCaseCardDraft);
  const [clinicalNote, setClinicalNote] = useState("");
  const [uploadedImaging, setUploadedImaging] = useState<{ name: string; size: number } | null>(null);
  const [uploadedNoteFile, setUploadedNoteFile] = useState<{ name: string; size: number } | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    Array<{ id: string; role: "assistant" | "user"; content: string }>
  >([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Clinical assistant online. Share imaging impressions, symptom timeline, or referral details and I will structure the case profile."
    }
  ]);
  const [isIngestingImage, setIsIngestingImage] = useState(false);
  const [isAnalyzingNotes, setIsAnalyzingNotes] = useState(false);
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const completion = useMemo(() => computeCaseCompletion(draft), [draft]);

  const mergeDraft = (patch: Partial<CaseCardDraft>) => {
    setDraft((current) => ({
      ...current,
      ...patch,
      currentSymptoms: patch.currentSymptoms
        ? Array.from(new Set([...current.currentSymptoms, ...patch.currentSymptoms]))
        : current.currentSymptoms
    }));
  };

  const addChatMessage = (role: "assistant" | "user", content: string) => {
    setChatMessages((current) => [
      ...current,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, role, content }
    ]);
  };

  const handleImagingPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadedImaging({ name: file.name, size: file.size });
    setIsIngestingImage(true);

    try {
      const result = await mockIngestImagingFile(file.name);
      mergeDraft(result.patch);
      addChatMessage("assistant", result.reply);
    } finally {
      setIsIngestingImage(false);
      event.target.value = "";
    }
  };

  const handleNotesFilePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadedNoteFile({ name: file.name, size: file.size });
    addChatMessage(
      "assistant",
      `Loaded ${file.name}. Paste the content in Clinical Notes and click Analyze to map fields.`
    );
    event.target.value = "";
  };

  const handleAnalyzeNotes = async () => {
    if (!clinicalNote.trim()) {
      addChatMessage("assistant", "Add or paste clinical notes first, then I can analyze and populate the card.");
      return;
    }

    setIsAnalyzingNotes(true);
    try {
      const result = await mockAnalyzeClinicalNote(clinicalNote);
      mergeDraft(result.patch);
      addChatMessage("assistant", result.reply);
    } finally {
      setIsAnalyzingNotes(false);
    }
  };

  const handleSend = async () => {
    const message = chatInput.trim();
    if (!message) {
      return;
    }

    setChatInput("");
    addChatMessage("user", message);
    setIsAgentThinking(true);

    try {
      const result = await mockRespondToAgent(message, draft);
      mergeDraft(result.patch);
      addChatMessage("assistant", result.reply);
    } finally {
      setIsAgentThinking(false);
    }
  };

  const confidenceTone =
    completion.score >= 80 ? "text-[var(--mr-success)]" : completion.score >= 50 ? "text-[var(--mr-warning)]" : "text-[var(--mr-text)]";
  const confidenceRingColor =
    completion.score >= 80 ? "var(--mr-success)" : completion.score >= 50 ? "var(--mr-warning)" : "var(--mr-action)";
  const confidenceLabel =
    completion.score >= 80 ? "High completeness" : completion.score >= 50 ? "Moderate completeness" : "Low completeness";

  const renderField = (value: string, placeholder = "Waiting for input") =>
    value ? (
      <p className="text-[15px] leading-[22px] text-[var(--mr-text)]">{value}</p>
    ) : (
      <p className="text-[15px] leading-[22px] text-[var(--mr-text-secondary)]">{placeholder}</p>
    );

  return (
    <div className="grid h-full min-h-0 gap-6 overflow-hidden lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="min-h-0 flex flex-col overflow-hidden">
        <SurfaceCard className="h-full min-h-0 overflow-y-auto">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Case card draft</p>
              <h2 className="text-[22px] font-semibold leading-7 text-[var(--mr-text)]">Case profile</h2>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--mr-border)] bg-[var(--mr-bg-subtle)] px-3 py-2">
              <div
                role="img"
                aria-label={`Confidence ${completion.score}%`}
                className="relative grid h-14 w-14 place-items-center rounded-full"
                style={{
                  background: `conic-gradient(${confidenceRingColor} ${completion.score}%, var(--mr-border) ${completion.score}% 100%)`
                }}
              >
                <div className="grid h-10 w-10 place-items-center rounded-full bg-white">
                  <p className={cn("text-xs font-semibold leading-4", confidenceTone)}>{completion.score}%</p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn("text-sm font-semibold leading-5", confidenceTone)}>{confidenceLabel}</p>
                <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Confidence score</p>
              </div>
            </div>
          </div>

          <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">
            Confidence reflects structured clinical fields captured from imaging and narrative intake.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-0.5">
              <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Age</p>
              {renderField(draft.patientAge, "Not captured")}
            </div>
            <div className="space-y-0.5">
              <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Sex</p>
              {renderField(draft.patientSex, "Not captured")}
            </div>
            <div className="space-y-0.5 sm:col-span-2">
              <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Primary concern</p>
              {renderField(draft.presentingConcern, "Waiting for concern from note or chat")}
            </div>
            <div className="space-y-0.5 sm:col-span-2">
              <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Symptoms</p>
              {draft.currentSymptoms.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {draft.currentSymptoms.map((symptom) => (
                    <span key={symptom} className="mr-badge mr-badge--neutral">
                      {symptom}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[15px] leading-[22px] text-[var(--mr-text-secondary)]">
                  Waiting for symptom extraction
                </p>
              )}
            </div>
            <div className="space-y-0.5 sm:col-span-2">
              <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Suspected diagnosis</p>
              {renderField(draft.suspectedDiagnosis, "No diagnostic hypothesis yet")}
            </div>
            <div className="space-y-0.5">
              <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Imaging modality</p>
              {renderField(draft.imagingModality, "Awaiting imaging upload")}
            </div>
            <div className="space-y-0.5">
              <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Imaging file</p>
              {renderField(draft.imagingFileName, "No file attached")}
            </div>
            <div className="space-y-0.5 sm:col-span-2">
              <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Clinical summary</p>
              {renderField(draft.clinicalSummary, "Summary appears after note analysis")}
            </div>
            <div className="space-y-0.5">
              <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Vitals</p>
              {renderField(draft.vitals, "Optional")}
            </div>
            <div className="space-y-0.5">
              <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Allergies</p>
              {renderField(draft.allergies, "Optional")}
            </div>
          </div>

          <div className="mr-divider" />

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--mr-text-secondary)]" />
              <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Missing for stronger confidence</p>
            </div>
            {completion.missing.length === 0 ? (
              <p className="text-[15px] leading-[22px] text-[var(--mr-text)]">
                Required fields captured. Ready for review.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {completion.missing.map((missingField) => (
                  <span key={missingField} className="mr-badge mr-badge--warning">
                    {missingField}
                  </span>
                ))}
              </div>
            )}
          </div>
        </SurfaceCard>
      </div>

      <div className="relative min-h-0 flex flex-col overflow-hidden">
        {isChatOpen ? (
          <SurfaceCard className="h-full min-h-0 gap-0 overflow-hidden border border-[var(--mr-border)] bg-gradient-to-b from-white to-[var(--mr-bg-subtle)] p-0 shadow-[0_14px_30px_rgba(15,67,102,0.12)]">
            <div className="space-y-3 border-b border-[var(--mr-border)] bg-white/85 px-4 py-3 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#dceef9] text-[#0a678f]">
                    <Bot className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-[17px] font-semibold leading-[22px] text-[var(--mr-text)]">Clinical Decision Support</h2>
                    <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">AI triage copilot</p>
                  </div>
                </div>
                <span className="rounded-full border border-[#c6dced] bg-[#eff8ff] px-2 py-0.5 text-[11px] font-medium text-[#0a678f]">
                  Live inference
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--mr-border)] bg-white px-3 py-2">
                  <p className="text-[11px] leading-4 text-[var(--mr-text-secondary)]">Clinical lane</p>
                  <p className="text-[13px] font-medium leading-5 text-[var(--mr-text)]">Thoracic oncology routing</p>
                </div>
                <div className="rounded-xl border border-[var(--mr-border)] bg-white px-3 py-2">
                  <p className="text-[11px] leading-4 text-[var(--mr-text-secondary)]">Assistant behavior</p>
                  <p className="text-[13px] font-medium leading-5 text-[var(--mr-text)]">Extract, normalize, and summarize</p>
                </div>
              </div>

              <div className="flex justify-end">
                <MedButton variant="secondary" size="sm" onClick={() => setIsChatOpen(false)}>
                  Minimize
                </MedButton>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-auto bg-gradient-to-b from-[#f4fafe] to-[#ecf5fb] px-4 py-3">
              {chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-5 shadow-[0_4px_14px_rgba(15,67,102,0.08)]",
                      message.role === "user"
                        ? "bg-[var(--mr-action)] text-[var(--mr-on-action)]"
                        : "border border-[#c6dced] bg-[#f6fbff] text-[var(--mr-text)]"
                    )}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              {isAgentThinking ? (
                <div className="flex items-center gap-2 rounded-lg border border-[#c6dced] bg-[#f6fbff] px-3 py-2 text-xs leading-4 text-[var(--mr-text-secondary)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Running clinical reasoning on current intake...
                </div>
              ) : null}
            </div>

            <div className="border-t border-[var(--mr-border)] bg-white/90 p-3 backdrop-blur">
              <div className="flex items-center gap-2">
                <input
                  className="mr-input"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Enter clinical detail, e.g. '52M with hemoptysis and mediastinal LAD on CT'"
                />
                <MedButton variant="primary" size="sm" onClick={() => void handleSend()} disabled={isAgentThinking}>
                  <SendHorizontal className="h-4 w-4" />
                  Submit
                </MedButton>
              </div>
            </div>
          </SurfaceCard>
        ) : (
          <>
            <SurfaceCard className="min-h-0 overflow-y-auto border border-[var(--mr-border)] bg-white shadow-[0_10px_24px_rgba(0,0,0,0.04)]">
              <div className="rounded-2xl border border-[var(--mr-border)] bg-gradient-to-br from-[var(--mr-bg-subtle)] to-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Intake workspace</p>
                    <h2 className="text-[18px] font-semibold leading-6 text-[var(--mr-text)]">Clinical Context Intake</h2>
                    <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">
                      Capture radiology studies, physician narrative, and privacy controls for downstream triage.
                    </p>
                  </div>
                  <span className="inline-flex h-7 items-center rounded-full border border-[var(--mr-border)] bg-white px-3 text-xs leading-4 text-[var(--mr-text-secondary)]">
                    Active intake
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-[var(--mr-border)] bg-white px-3 py-2">
                    <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Radiology channel</p>
                    <p className="text-[14px] leading-5 text-[var(--mr-text)]">DICOM and image metadata extraction</p>
                  </div>
                  <div className="rounded-xl border border-[var(--mr-border)] bg-white px-3 py-2">
                    <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Narrative channel</p>
                    <p className="text-[14px] leading-5 text-[var(--mr-text)]">H&P, referral notes, symptom timeline</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--mr-border)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <UploadCloud className="h-4 w-4 text-[var(--mr-text-secondary)]" />
                      <h3 className="text-[15px] font-semibold leading-[22px] text-[var(--mr-text)]">Radiology packet</h3>
                    </div>
                    <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">
                      Attach CT, MRI, or X-ray studies to auto-capture modality and preliminary findings.
                    </p>
                  </div>
                  <span className="inline-flex h-6 items-center rounded-full border border-[var(--mr-border)] bg-[var(--mr-bg-subtle)] px-2.5 text-xs leading-4 text-[var(--mr-text-secondary)]">
                    {uploadedImaging ? "Study received" : "Awaiting study"}
                  </span>
                </div>

                <div className="pt-3">
                  <input
                    ref={imagingInputRef}
                    type="file"
                    accept=".dcm,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={handleImagingPick}
                  />
                  <button
                    type="button"
                    onClick={() => imagingInputRef.current?.click()}
                    disabled={isIngestingImage}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--mr-border)] bg-white px-3 text-[13px] font-medium text-[var(--mr-text)] transition hover:bg-[var(--mr-bg-subtle)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isIngestingImage ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing study...
                      </>
                    ) : (
                      "Attach imaging study"
                    )}
                  </button>
                </div>

                {uploadedImaging ? (
                  <div className="mt-3 rounded-xl border border-[var(--mr-border)] bg-[var(--mr-bg-subtle)] px-3 py-2">
                    <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Study file</p>
                    <p className="text-[15px] leading-[22px] text-[var(--mr-text)]">{uploadedImaging.name}</p>
                    <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">
                      {(uploadedImaging.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-[var(--mr-border)] p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[var(--mr-text-secondary)]" />
                    <h3 className="text-[15px] font-semibold leading-[22px] text-[var(--mr-text)]">Clinical narrative</h3>
                  </div>
                  <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">
                    Provide physician note, H&P, referral summary, and symptom progression.
                  </p>
                </div>

                <div className="pt-3 space-y-1">
                  <p className="text-xs leading-4 text-[var(--mr-text-secondary)]">Narrative source text</p>
                  <textarea
                    className="mr-textarea min-h-[220px]"
                    placeholder="Example: 52-year-old with persistent hemoptysis, unintentional weight loss, and right hilar mass noted on CT chest..."
                    value={clinicalNote}
                    onChange={(event) => setClinicalNote(event.target.value)}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-3">
                  <input
                    ref={notesFileInputRef}
                    type="file"
                    accept=".txt,.pdf,.doc,.docx"
                    className="hidden"
                    onChange={handleNotesFilePick}
                  />
                  <button
                    type="button"
                    onClick={() => notesFileInputRef.current?.click()}
                    className="inline-flex h-9 items-center rounded-lg border border-[var(--mr-border)] bg-white px-3 text-[13px] font-medium text-[var(--mr-text)] transition hover:bg-[var(--mr-bg-subtle)]"
                  >
                    Attach referral document
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAnalyzeNotes()}
                    disabled={isAnalyzingNotes}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--mr-action)] px-3 text-[13px] font-medium text-[var(--mr-on-action)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isAnalyzingNotes ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Extracting findings...
                      </>
                    ) : (
                      "Extract structured findings"
                    )}
                  </button>
                </div>

                {uploadedNoteFile ? (
                  <p className="pt-2 text-xs leading-4 text-[var(--mr-text-secondary)]">
                    Attached narrative document: {uploadedNoteFile.name}
                  </p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-[var(--mr-border)] bg-[var(--mr-bg-subtle)] p-4">
                <h3 className="text-[15px] font-semibold leading-[22px] text-[var(--mr-text)]">Privacy and retention</h3>
                <p className="pt-1 text-xs leading-4 text-[var(--mr-text-secondary)]">
                  Control PHI handling and case archival before running intake.
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-2 pt-3">
                  <LabeledCheckbox
                    checked={deIdentify}
                    label="Auto de-identify PHI during ingestion"
                    onChange={onDeIdentifyChange}
                  />
                  <LabeledCheckbox
                    checked={saveToHistory}
                    label="Store in longitudinal case history"
                    onChange={onSaveHistoryChange}
                  />
                </div>
              </div>
            </SurfaceCard>
            <button
              type="button"
              onClick={() => setIsChatOpen(true)}
              aria-label="Open clinical assistant"
              className="absolute bottom-4 right-4 inline-flex h-14 w-14 items-center justify-center rounded-full border border-[#b8d4e7] bg-gradient-to-br from-[#0d739d] to-[#08597a] text-[var(--mr-on-action)] shadow-[0_14px_28px_rgba(8,89,122,0.34)] transition hover:scale-[1.02]"
            >
              <Bot className="h-5 w-5" />
            </button>
          </>
        )}
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
            <Stepper step={step} onStepChange={setStep} />
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
    </div>
  );
}
