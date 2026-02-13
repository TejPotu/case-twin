import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
}

export function Checkbox({ checked, onCheckedChange, id }: CheckboxProps) {
  return (
    <button
      id={id}
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "flex h-[18px] w-[18px] items-center justify-center rounded-md border border-slate-300 transition-all duration-200",
        checked
          ? "border-blue-600 bg-blue-600 text-white shadow-[0_3px_10px_rgba(37,99,235,0.28)]"
          : "bg-white text-transparent hover:border-slate-400"
      )}
    >
      <Check className="h-3 w-3" />
    </button>
  );
}
