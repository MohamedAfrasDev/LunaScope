"use client";

import { Globe, History, House, Mountain, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { ResultBadge } from "@/components/ui/result-badge";
import { clearRecentRuns, useRecentRuns } from "@/lib/recent-runs";
import { shortId } from "@/lib/format";
import type { RunStatusResponse } from "@/lib/api/types";

type Item = { href: string; label: string; icon: typeof House; exact?: boolean };

const MISSION: Item[] = [
  { href: "/", label: "Home", icon: House, exact: true },
  { href: "/analyze", label: "New analysis", icon: Plus },
  { href: "/explore", label: "Explore the Moon", icon: Globe },
];
const LEARN: Item[] = [{ href: "/why-the-south-pole-is-hard", label: "Why the south pole is hard", icon: Mountain }];

function isCurrent(path: string | null, it: Item) {
  if (!path) return false;
  return it.exact ? path === it.href : path === it.href || path.startsWith(`${it.href}/`);
}

function Links({ items, path }: { items: Item[]; path: string | null }) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarMenu>
      {items.map((it) => (
        <SidebarMenuItem key={it.href}>
          <SidebarMenuButton asChild tooltip={it.label} isActive={isCurrent(path, it)}>
            <Link
              href={it.href}
              aria-current={isCurrent(path, it) ? "page" : undefined}
              onClick={() => isMobile && setOpenMobile(false)}
            >
              <it.icon aria-hidden="true" />
              <span>{it.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

function Recent({ path }: { path: string | null }) {
  const runs = useRecentRuns();
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Recent runs</SidebarGroupLabel>
      {runs.length > 0 && (
        <SidebarGroupAction title="Clear recent runs" aria-label="Clear recent runs" onClick={clearRecentRuns} className="w-6">
          <Trash2 aria-hidden="true" />
        </SidebarGroupAction>
      )}
      <SidebarGroupContent>
        {runs.length === 0 ? (
          <p className="px-2 py-1 text-xs leading-5 text-sidebar-foreground/70">Analyses you open appear here, on this device only.</p>
        ) : (
          <SidebarMenu>
            {runs.map((r) => {
              const on = !!path && path.startsWith(`/runs/${r.id}`);
              return (
                <SidebarMenuItem key={r.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={on}
                    className="h-auto min-h-8 items-start py-1.5"
                  >
                    <Link
                      href={`/runs/${r.id}`}
                      aria-current={on ? "page" : undefined}
                      onClick={() => isMobile && setOpenMobile(false)}
                    >
                      <History aria-hidden="true" className="mt-0.5" />
                      <span className="grid min-w-0 gap-0.5">
                        <span className="truncate">{r.label}</span>
                        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-sidebar-foreground/70">
                          <span className="readout">{shortId(r.id)}</span>
                          {r.state && <ResultBadge state={r.state as RunStatusResponse["result_state"]} />}
                        </span>
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function Nav({ path }: { path: string | null }) {
  return (
    <nav aria-label="Main" className="contents">
      <SidebarGroup>
        <SidebarGroupLabel>Mission</SidebarGroupLabel>
        <SidebarGroupContent>
          <Links items={MISSION} path={path} />
        </SidebarGroupContent>
      </SidebarGroup>
      <Recent path={path} />
      <SidebarGroup>
        <SidebarGroupLabel>Learn</SidebarGroupLabel>
        <SidebarGroupContent>
          <Links items={LEARN} path={path} />
        </SidebarGroupContent>
      </SidebarGroup>
    </nav>
  );
}

function CurrentNav() {
  return <Nav path={usePathname()} />;
}

/**
 * The app's side navigation (galaxy D4): an icon-collapsible rail on desktop, a sheet on phones. The current page is
 * read from the URL, which is request data, so it streams in behind a fully usable, static list of links.
 */
export function AppSidebar() {
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="px-3 py-3">
        <Link href="/" className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
            <path d="M12 3a9 9 0 0 0 0 18 6 6 0 0 1 0-18Z" fill="currentColor" />
          </svg>
          <span className="group-data-[collapsible=icon]:hidden">LunaScope</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <Suspense fallback={<Nav path={null} />}>
          <CurrentNav />
        </Suspense>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
