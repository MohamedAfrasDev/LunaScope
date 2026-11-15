"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, Suspense } from "react";
import { DataStatusPill } from "@/components/DataStatusBanner";
import { ViewModeToggle } from "@/components/ViewMode";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { PaletteButton } from "@/components/shell/CommandPalette";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { shortId } from "@/lib/format";

const RUN_VIEWS: Record<string, string> = {
  timeline: "Timeline",
  sky: "Sky",
  compare: "Compare",
  "time-machine": "Time Machine",
  evidence: "Evidence",
};

type Crumb = { label: string; href?: string };

/** Where the URL says we are. Names are the product's own; a run is its short id, as everywhere else. */
export function crumbsFor(pathname: string): Crumb[] {
  const home: Crumb = { label: "Home", href: "/" };
  if (pathname === "/" || pathname === "") return [{ label: "Home" }];
  if (pathname === "/analyze" || pathname.startsWith("/analyze/")) return [home, { label: "New analysis" }];
  if (pathname.startsWith("/why-the-south-pole-is-hard")) return [home, { label: "Why the south pole is hard" }];
  const m = pathname.match(/^\/runs\/([^/]+)(?:\/([^/]+))?/);
  if (m) {
    const run = `/runs/${m[1]}`;
    const view = m[2] ? RUN_VIEWS[m[2]] : undefined;
    const label = `Analysis ${shortId(decodeURIComponent(m[1]))}`;
    return view ? [home, { label, href: run }, { label: view }] : [home, { label }];
  }
  return [home];
}

function Crumbs({ pathname }: { pathname: string }) {
  const crumbs = crumbsFor(pathname);
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={`${i}-${c.label}`}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {last || !c.href ? (
                  <BreadcrumbPage>{c.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={c.href} className="inline-flex min-h-6 items-center">{c.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function CurrentCrumbs() {
  return <Crumbs pathname={usePathname() ?? "/"} />;
}

/**
 * The slim bar above the content: the sidebar control, where you are, and the two things that must always be in
 * view: the data-status pill (the trust label) and the Guided/Technical switch.
 */
export function ShellBar() {
  return (
    <header className="chrome-glass sticky top-0 z-30 border-b border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2">
        <SidebarTrigger className="-ml-1.5" />
        <Suspense fallback={<Crumbs pathname="/" />}>
          <CurrentCrumbs />
        </Suspense>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <PaletteButton />
          <DataStatusPill />
          <ViewModeToggle />
        </div>
      </div>
    </header>
  );
}
