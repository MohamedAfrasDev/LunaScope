import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TimeMachineView } from "@/components/TimeMachineView";

export const metadata: Metadata = { title: "Mission Time Machine" };

const RUN_ID = /^[0-9a-f]{64}$/;

async function Body({ params }: { params: PageProps<"/runs/[runId]/time-machine">["params"] }) {
  const { runId } = await params; // runtime data: read inside Suspense
  if (!RUN_ID.test(runId)) notFound();
  return <TimeMachineView key={runId} runId={runId} />;
}

export default function TimeMachinePage(props: PageProps<"/runs/[runId]/time-machine">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Body params={props.params} />
    </Suspense>
  );
}
