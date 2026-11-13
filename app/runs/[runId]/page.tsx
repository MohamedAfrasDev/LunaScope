import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RunView } from "@/components/RunView";

export const metadata: Metadata = { title: "Analysis" };

const RUN_ID = /^[0-9a-f]{64}$/;

async function Body({ params }: { params: PageProps<"/runs/[runId]">["params"] }) {
  const { runId } = await params; // runtime data: read inside Suspense
  if (!RUN_ID.test(runId)) notFound();
  return <RunView key={runId} runId={runId} />;
}

export default function RunPage(props: PageProps<"/runs/[runId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Body params={props.params} />
    </Suspense>
  );
}
