"use client";

import { Copy, Globe, History, House, Search, Trash2, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { shortId } from "@/lib/format";
import { clearRecentRuns, useRecentRuns } from "@/lib/recent-runs";
import { toast } from "sonner";

const OPEN_EVENT = "lunascope:palette";

/** Open the palette from anywhere (the bar's search button uses this). */
export function openCommandPalette(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/** The visible way in, for anyone who does not know the shortcut. */
export function PaletteButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={openCommandPalette}
      aria-keyshortcuts="Control+K Meta+K"
      className="gap-2 text-muted-foreground"
    >
      <Search aria-hidden="true" />
      <span>Search</span>
      <kbd aria-hidden="true" className="hidden rounded border border-border px-1 font-mono text-[0.6875rem] sm:inline">
        Ctrl K
      </kbd>
    </Button>
  );
}

type Entry = { id: string; label: string; hint?: string; icon: LucideIcon; run: () => void; keywords?: string };

function typing(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/**
 * Command palette (galaxy D6): a keyboard shortcut layer over pages, recent runs, the views of the open run, and a few
 * actions. It is never the only way to anything. Opens with Ctrl/Cmd+K, or "/" when not typing; the dialog traps focus,
 * closes with Escape and has a name.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const runs = useRecentRuns();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (k === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !typing(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  const go = useCallback(
    (href: string) => () => {
      router.push(href);
    },
    [router],
  );

  const pages: Entry[] = [
    { id: "home", label: "Home", icon: House, run: go("/") },
    { id: "atlas", label: "Open the Atlas", icon: Globe, run: go("/atlas"), keywords: "moon globe sites time clock" },
  ];

  const actions: Entry[] = [
    {
      id: "a-copy",
      label: "Copy link to this page",
      icon: Copy,
      run: () => {
        const copy = navigator.clipboard?.writeText(window.location.href);
        if (!copy) return void toast.error("This browser would not copy the link. Copy it from the address bar.");
        copy.then(() => toast.success("Link copied"), () => toast.error("The link could not be copied. Copy it from the address bar."));
      },
    },
  ];
  if (runs.length > 0) actions.push({ id: "a-clear", label: "Clear recent runs", icon: Trash2, run: () => { clearRecentRuns(); toast("Recent runs cleared"); } });

  const choose = (e: Entry) => {
    setOpen(false);
    e.run();
  };

  const item = (e: Entry) => (
    <CommandItem key={e.id} value={`${e.label} ${e.keywords ?? ""} ${e.hint ?? ""}`} onSelect={() => choose(e)}>
      <e.icon aria-hidden="true" />
      <span>{e.label}</span>
      {e.hint && <span className="ml-auto text-xs text-muted-foreground">{e.hint}</span>}
    </CommandItem>
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search LunaScope"
      description="Go to a page or a recent run, or run an action. Type to filter, Enter to choose, Escape to close."
      className="chrome-glass sm:max-w-lg"
    >
      <Command>
      <CommandInput placeholder="Go to a page, a run, or an action…" />
      <CommandList>
        <CommandEmpty>Nothing matches. Try a page name or a recent run.</CommandEmpty>
        <CommandGroup heading="Pages">{pages.map(item)}</CommandGroup>
        {runs.length > 0 && (
          <>
            <CommandGroup heading="Recent runs">
              {runs.map((r) =>
                item({ id: `r-${r.id}`, label: r.label, hint: shortId(r.id), icon: History, run: go(`/atlas?run=${r.id}`), keywords: r.id }),
              )}
            </CommandGroup>
          </>
        )}
        <CommandGroup heading="Actions">{actions.map(item)}</CommandGroup>
      </CommandList>
      </Command>
    </CommandDialog>
  );
}
