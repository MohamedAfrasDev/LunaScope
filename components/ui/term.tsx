"use client";

import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { glossaryEntry, type GlossaryId } from "@/lib/glossary";

/**
 * A key term with its plain-language meaning one press away. It is a real button (Enter, Space, tap or click open it,
 * Escape closes it), so it works with a keyboard, a screen reader and a touch screen, which a hover-only tooltip does not.
 */
export function Term({ id, children }: { id: GlossaryId; children?: ReactNode }) {
  const g = glossaryEntry(id);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-6 items-center rounded-sm underline decoration-dotted underline-offset-4 hover:decoration-solid"
        >
          {children ?? g.term}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm leading-6">
        <p className="font-medium">{g.term}</p>
        <p className="mt-1 text-muted-foreground">{g.text}</p>
      </PopoverContent>
    </Popover>
  );
}
