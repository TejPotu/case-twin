import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type AccordionContextValue = {
  value: string | null;
  setValue: (value: string | null) => void;
};

const AccordionContext = React.createContext<AccordionContextValue | null>(null);

export function Accordion({
  children,
  defaultValue
}: {
  children: React.ReactNode;
  defaultValue?: string;
}) {
  const [value, setValue] = React.useState<string | null>(defaultValue ?? null);

  return (
    <AccordionContext.Provider value={{ value, setValue }}>
      <div className="w-full">{children}</div>
    </AccordionContext.Provider>
  );
}

const ItemContext = React.createContext<string | null>(null);

export function AccordionItem({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <ItemContext.Provider value={value}>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">{children}</div>
    </ItemContext.Provider>
  );
}

export function AccordionTrigger({ children }: { children: React.ReactNode }) {
  const context = React.useContext(AccordionContext);
  const itemValue = React.useContext(ItemContext);

  if (!context || !itemValue) {
    return null;
  }

  const isOpen = context.value === itemValue;

  return (
    <button
      type="button"
      onClick={() => context.setValue(isOpen ? null : itemValue)}
      className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50"
    >
      {children}
      <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", isOpen && "rotate-180")} />
    </button>
  );
}

export function AccordionContent({ children }: { children: React.ReactNode }) {
  const context = React.useContext(AccordionContext);
  const itemValue = React.useContext(ItemContext);

  if (!context || !itemValue) {
    return null;
  }

  if (context.value !== itemValue) {
    return null;
  }

  return <div className="border-t border-slate-200 px-4 py-4">{children}</div>;
}
