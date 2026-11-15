"use client";

import { Minus, Plus, X } from "lucide-react";
import { useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Tag, type TagKind } from "@/components/atlas/Tag";
import { cn } from "@/lib/utils";

/** Wide enough screens only: on a phone the panels are bottom sheets and stay where they are. */
const MOVABLE_MIN_WIDTH = 768;
const MIN_W = 240;
const MIN_H = 120;
const KEEP_VISIBLE = 80; // px of the title bar that always stays on screen
let topZ = 20;

/**
 * A floating Atlas panel (spec 5.4): a monospace title, a minimise button, an optional close button, and a body that
 * scrolls inside itself (thin scrollbar, never sideways). The answer goes first in the body; long detail is folded.
 * On a wide screen it can be dragged by its title bar and resized from its bottom-right corner (double-click the title bar to put it
 * back); it never leaves the screen. Where it sits is the person's choice, so nothing else moves because of it.
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
  const root = useRef<HTMLElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [z, setZ] = useState<number | undefined>(undefined);
  const movable = () => typeof window !== "undefined" && window.innerWidth >= MOVABLE_MIN_WIDTH;
  const raise = () => setZ(++topZ);

  function startDrag(e: ReactPointerEvent<HTMLElement>) {
    if (e.button !== 0 || !movable() || (e.target as HTMLElement).closest("button")) return;
    const el = root.current;
    if (!el) return;
    raise();
    const r = el.getBoundingClientRect();
    const from = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y, left: r.left, top: r.top, w: r.width };
    const head = e.currentTarget;
    head.setPointerCapture?.(e.pointerId);
    const move = (ev: PointerEvent) => {
      const dx = Math.min(window.innerWidth - KEEP_VISIBLE - from.left, Math.max(KEEP_VISIBLE - from.w - from.left, ev.clientX - from.px));
      const dy = Math.min(window.innerHeight - 40 - from.top, Math.max(-from.top, ev.clientY - from.py));
      setPos({ x: from.x + dx, y: from.y + dy });
    };
    const up = () => {
      head.removeEventListener("pointermove", move);
      head.removeEventListener("pointerup", up);
      head.removeEventListener("pointercancel", up);
    };
    head.addEventListener("pointermove", move);
    head.addEventListener("pointerup", up);
    head.addEventListener("pointercancel", up);
  }

  function startResize(e: ReactPointerEvent<HTMLElement>) {
    if (e.button !== 0 || !movable()) return;
    const el = root.current;
    if (!el) return;
    e.stopPropagation();
    raise();
    const r = el.getBoundingClientRect();
    const from = { px: e.clientX, py: e.clientY, w: r.width, h: r.height, left: r.left, top: r.top };
    const grip = e.currentTarget;
    grip.setPointerCapture?.(e.pointerId);
    const move = (ev: PointerEvent) =>
      setSize({
        w: Math.round(Math.min(window.innerWidth - from.left - 8, Math.max(MIN_W, from.w + ev.clientX - from.px))),
        h: Math.round(Math.min(window.innerHeight - from.top - 8, Math.max(MIN_H, from.h + ev.clientY - from.py))),
      });
    const up = () => {
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
      grip.removeEventListener("pointercancel", up);
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
    grip.addEventListener("pointercancel", up);
  }

  const moved = pos.x !== 0 || pos.y !== 0 || size !== null;
  return (
    <section
      ref={root}
      aria-labelledby={heading}
      data-focused={focused}
      data-moved={moved || undefined}
      onPointerDown={() => moved && raise()}
      style={{
        transform: pos.x || pos.y ? `translate(${pos.x}px, ${pos.y}px)` : undefined,
        width: size ? size.w : undefined,
        height: size && open ? size.h : undefined,
        flex: size && open ? "none" : undefined,
        alignSelf: size ? "flex-start" : undefined,
        zIndex: z,
      }}
      className={cn("atlas-panel relative flex min-h-0 flex-col", className)}
    >
      <header
        className="flex touch-none items-center gap-2 border-b border-[var(--panel-edge)] px-3 py-2 md:cursor-grab md:active:cursor-grabbing"
        data-testid="panel-handle"
        title="Drag to move. Double-click to put it back."
        onPointerDown={startDrag}
        onDoubleClick={(e) => {
          if (!(e.target as HTMLElement).closest("button")) {
            setPos({ x: 0, y: 0 });
            setSize(null);
          }
        }}
      >
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
      {/* a panel body can scroll, so it takes keyboard focus (arrow keys scroll it) */}
      <div id={body} hidden={!open} tabIndex={0} className={cn("atlas-scroll min-h-0 flex-1 px-3 py-3", bodyClassName)}>
        {children}
      </div>
      {open && (
        <span
          aria-hidden="true"
          data-testid="panel-resize"
          onPointerDown={startResize}
          className="absolute bottom-0 right-0 z-10 hidden size-4 cursor-se-resize touch-none md:block"
        >
          <svg viewBox="0 0 16 16" className="size-4 text-[var(--ink-dim)]">
            <path d="M14 5 5 14M14 9 9 14M14 13 13 14" stroke="currentColor" strokeWidth="1.2" fill="none" />
          </svg>
        </span>
      )}
    </section>
  );
}
