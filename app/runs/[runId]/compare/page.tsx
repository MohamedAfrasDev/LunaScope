import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CompareView } from "@/components/CompareView";

export const metadata: Metadata = { title: "Compare sites" };

const RUN_ID = /^[0-9a-f]{64}$/;

async function Body({ params }: { params: PageProps<"/runs/[runId]/compare">["params"] }) {
  const { runId } = await params; // runtime data: read inside Suspense
  if (!RUN_ID.test(runId)) notFound();
  return <CompareView key={runId} runId={runId} />;
}

export default function ComparePage(props: PageProps<"/runs/[runId]/compare">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Body params={props.params} />
    </Suspense>
  );
}
