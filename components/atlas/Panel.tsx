"use client";

import { Minus, Plus, X } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Tag, type TagKind } from "@/components/atlas/Tag";
import { cn } from "@/lib/utils";

/**
 * A floating Atlas panel (spec 5.4): a monospace title, a minimise button, an optional close button, and a body that
 * scrolls inside itself (thin scrollbar, never sideways). The answer goes first in the body; long detail is folded.
 */
export function Panel({
  title,
  tag,
  children,
  focused = false,
  defaultOpen = true,
  onClose,
  className,
  bodyClassName,
}: {
  title: string;
  tag?: TagKind;
  children: ReactNode;
  focused?: boolean;
  defaultOpen?: boolean;
  onClose?: () => void;
  className?: string;
  bodyClassName?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const heading = useId();
  const body = useId();
  return (
    <section aria-labelledby={heading} data-focused={focused} className={cn("atlas-panel flex min-h-0 flex-col", className)}>
      <header className="flex items-center gap-2 border-b border-[var(--panel-edge)] px-3 py-2">
        <h2 id={heading} className="atlas-label-lg min-w-0 flex-1 truncate text-[var(--ink)]">
          {title}
        </h2>
        {tag && <Tag kind={tag} />}
        <button
          type="button"
          className="atlas-key grid size-7 place-items-center p-0"
          aria-expanded={open}
          aria-controls={body}
          aria-label={`${open ? "Collapse" : "Expand"} ${title}`}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <Minus aria-hidden="true" className="size-4" /> : <Plus aria-hidden="true" className="size-4" />}
        </button>
        {onClose && (
          <button type="button" className="atlas-key grid size-7 place-items-center p-0" aria-label={`Close ${title}`} onClick={onClose}>
            <X aria-hidden="true" className="size-4" />
          </button>
        )}
      </header>
      <div id={body} hidden={!open} className={cn("atlas-scroll min-h-0 flex-1 px-3 py-3", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}
