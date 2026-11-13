import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EvidencePanel } from "@/components/EvidencePanel";

export const metadata: Metadata = { title: "Evidence" };

const RUN_ID = /^[0-9a-f]{64}$/;

async function Body({ params }: { params: PageProps<"/runs/[runId]/evidence">["params"] }) {
  const { runId } = await params; // runtime data: read inside Suspense
  if (!RUN_ID.test(runId)) notFound();
  return <EvidencePanel key={runId} runId={runId} />;
}

export default function EvidencePage(props: PageProps<"/runs/[runId]/evidence">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Body params={props.params} />
    </Suspense>
  );
}
