import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SkyView } from "@/components/SkyView";

export const metadata: Metadata = { title: "Local sky" };

const RUN_ID = /^[0-9a-f]{64}$/;
const SITE_ID = /^[A-Za-z0-9._-]{1,64}$/;

async function Body({ params }: { params: PageProps<"/runs/[runId]/sky/[siteId]">["params"] }) {
  const { runId, siteId } = await params; // runtime data: read inside Suspense
  const site = decodeURIComponent(siteId);
  if (!RUN_ID.test(runId) || !SITE_ID.test(site)) notFound();
  return <SkyView key={`${runId}/${site}`} runId={runId} siteId={site} />;
}

export default function SkyPage(props: PageProps<"/runs/[runId]/sky/[siteId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Body params={props.params} />
    </Suspense>
  );
}
