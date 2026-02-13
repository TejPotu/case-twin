import { Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AboutPage() {
  return (
    <AppShell breadcrumb="About">
      <div className="mx-auto max-w-4xl space-y-4 fade-up">
        <Card className="overflow-hidden">
          <CardContent className="pt-6">
            <div className="mb-3 flex items-center gap-2">
              <Badge>About</Badge>
              <span className="text-xs uppercase tracking-wide text-slate-500">Case-Twin</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">
              Built for clinical routing teams that need clarity under time pressure.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
              Case-Twin (MedRoute AI) is a transfer support interface that compares incoming cases
              with relevant historical patterns, highlights triage-fit facilities, and helps create
              structured handoff notes in a single flow.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              Product Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-slate-700">
            <p>
              The current implementation is a frontend-only prototype. It focuses on interaction
              design, decision visibility, and communication quality across intake, matching,
              triage, and memo composition steps.
            </p>
            <p>
              Match results, triage suggestions, and protocol details are currently powered by mock
              data. The interface is intentionally structured so it can be connected to backend
              services and live hospital systems without major UI rewrites.
            </p>
            <p>
              The design language follows a clean, high-signal approach with restrained color,
              soft depth, and clear typographic hierarchy inspired by modern product surfaces.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
