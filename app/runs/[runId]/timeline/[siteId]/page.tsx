import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TimelineView } from "@/components/TimelineView";

export const metadata: Metadata = { title: "Timeline" };

const RUN_ID = /^[0-9a-f]{64}$/;
const SITE_ID = /^[A-Za-z0-9._-]{1,64}$/;

async function Body({ params }: { params: PageProps<"/runs/[runId]/timeline/[siteId]">["params"] }) {
  const { runId, siteId } = await params; // runtime data: read inside Suspense
  const site = decodeURIComponent(siteId);
  if (!RUN_ID.test(runId) || !SITE_ID.test(site)) notFound();
  return <TimelineView key={`${runId}/${site}`} runId={runId} siteId={site} />;
}

export default function TimelinePage(props: PageProps<"/runs/[runId]/timeline/[siteId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Body params={props.params} />
    </Suspense>
  );
}
