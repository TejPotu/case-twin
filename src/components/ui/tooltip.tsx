import * as React from "react";
import { cn } from "@/lib/utils";

export function Tooltip({
  content,
  children
}: {
  content: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open ? (
        <span
          className={cn(
            "absolute -top-10 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm"
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
