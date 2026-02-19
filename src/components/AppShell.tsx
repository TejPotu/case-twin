import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

interface AppShellProps {
  breadcrumb: string;
  children: React.ReactNode;
}

export function AppShell({ breadcrumb, children }: AppShellProps) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="group flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white transition-transform group-hover:scale-105">
              CT
            </span>
            <span className="text-sm font-semibold tracking-tight text-slate-900">Case-Twin</span>
          </Link>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
            {breadcrumb}
          </span>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700 text-white border-0">
                <Plus className="h-3.5 w-3.5" />
                New Case
              </Button>
            </Link>
            <a href="#" aria-label="Docs placeholder link">
              <Button variant="secondary" size="sm">
                Docs
              </Button>
            </a>
            <Tooltip content="Export will be enabled in a later iteration.">
              <span>
                <Button size="sm" disabled>
                  Export
                </Button>
              </span>
            </Tooltip>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 sm:py-9">{children}</main>
    </div>
  );
}
