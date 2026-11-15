"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect } from "react";
import { shortId, siteLabel } from "@/lib/format";
import { rememberRun } from "@/lib/recent-runs";
import { useRun } from "./RunView";
import { ResultBadge } from "./ui/result-badge";

const RUN_ID = /^[0-9a-f]{64}$/;

type Kind = "matrix" | "timeline" | "sky" | "compare" | "time-machine" | "evidence";

/** Which view of the run the URL is showing, and for site views, which site. */
export function parseView(pathname: string, base: string): { kind: Kind; siteId?: string } {
  const rest = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\/+/, "") : "";
  const [seg, site] = rest.split("/");
  if (seg === "timeline" || seg === "sky") return { kind: seg, siteId: site ? decodeURIComponent(site) : undefined };
  if (seg === "compare" || seg === "time-machine" || seg === "evidence") return { kind: seg };
  return { kind: "matrix" };
}

const tab = (active: boolean) =>
  `-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${
    active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
  }`;

/**
 * One run, one workspace: every view of an analysis is a tab in the same bar, so you always know
 * where you are inside it. Timeline and Sky are per-site views, so a second row switches the site
 * without going back to the matrix. Tabs are plain links to the existing routes.
 */
export function RunNav() {
  const params = useParams<{ runId?: string }>();
  const runId = params?.runId ?? "";
  return RUN_ID.test(runId) ? <RunNavFor key={runId} runId={runId} /> : null;
}

function RunNavFor({ runId }: { runId: string }) {
  const pathname = usePathname() ?? "";
  const { run, notFound } = useRun(runId);
  const siteKey = run?.matrix?.map((r) => r.site_id).join("|") ?? "";
  const state = run?.result_state;
  useEffect(() => {
    const ids = siteKey ? siteKey.split("|") : [];
    if (ids.length === 0) return; // nothing the service has said about this run yet
    const label = ids.length > 1 ? `${siteLabel(ids[0])} and ${ids.length - 1} more` : siteLabel(ids[0]);
    rememberRun({ id: runId, label, state, sites: ids });
  }, [runId, siteKey, state]);
  if (notFound) return null; // the page itself says the run does not exist

  const base = `/runs/${runId}`;
  const view = parseView(pathname, base);
  const sites = run?.matrix?.map((r) => r.site_id) ?? [];
  const firstSite = sites[0];

  const tabs: { kind: Kind; label: string; href: string }[] = [{ kind: "matrix", label: "Matrix", href: base }];
  if (firstSite) {
    tabs.push({ kind: "timeline", label: "Timeline", href: `${base}/timeline/${encodeURIComponent(view.kind === "timeline" && view.siteId ? view.siteId : firstSite)}` });
    tabs.push({ kind: "sky", label: "Sky", href: `${base}/sky/${encodeURIComponent(view.kind === "sky" && view.siteId ? view.siteId : firstSite)}` });
  }
  if (sites.length >= 2) tabs.push({ kind: "compare", label: "Compare", href: `${base}/compare` });
  tabs.push({ kind: "time-machine", label: "Time Machine", href: `${base}/time-machine` });
  tabs.push({ kind: "evidence", label: "Evidence", href: `${base}/evidence` });

  const showSites = (view.kind === "timeline" || view.kind === "sky") && sites.length > 1;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-border">
        <nav aria-label="Analysis views" className="-mb-px flex max-w-full overflow-x-auto">
          {tabs.map((t) => (
            <Link key={t.kind} href={t.href} className={tab(view.kind === t.kind)} aria-current={view.kind === t.kind ? "page" : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>
        <p className="flex items-center gap-2 pb-2 text-xs text-muted-foreground">
          <span className="readout">{shortId(runId)}</span>
          {run?.result_state && <ResultBadge state={run.result_state} />}
        </p>
      </div>
      {showSites && (
        <nav aria-label="Switch site" className="flex flex-wrap items-center gap-2 text-sm">
          <span className="eyebrow">Site</span>
          {sites.map((id) => {
            const on = id === view.siteId;
            return (
              <Link
                key={id}
                href={`${base}/${view.kind}/${encodeURIComponent(id)}`}
                aria-current={on ? "true" : undefined}
                className={`rounded-md border px-2.5 py-1 ${on ? "border-primary bg-muted font-medium" : "border-border text-muted-foreground hover:border-input hover:text-foreground"}`}
              >
                {siteLabel(id)}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
