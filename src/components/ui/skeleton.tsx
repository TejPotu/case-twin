import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl bg-slate-100 bg-[linear-gradient(90deg,#f1f5f9_0%,#e2e8f0_50%,#f1f5f9_100%)] bg-[length:240%_100%] animate-[shine_1.4s_ease-in-out_infinite]",
        className
      )}
    />
  );
}
