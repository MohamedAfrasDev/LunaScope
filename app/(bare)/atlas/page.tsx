import type { Metadata } from "next";
import { Suspense } from "react";
import { AtlasShell } from "@/components/atlas/AtlasShell";

export const metadata: Metadata = { title: "Atlas" };

/** Only the parameters the Atlas understands are passed on: the run, the reference and shared analysis inputs. */
async function Body({ searchParams }: { searchParams: PageProps<"/atlas">["searchParams"] }) {
  const sp = await searchParams; // runtime data: read inside Suspense
  const q = new URLSearchParams();
  for (const k of ["run", "ref", "d"]) {
    const v = sp[k];
    if (typeof v === "string") q.set(k, v);
  }
  return <AtlasShell initialSearch={q.toString()} />;
}

/** The new layout (docs/redesign/LAYOUT-SPEC.md). Lives in the (bare) route group, so it has no sidebar shell. */
export default function AtlasPage(props: PageProps<"/atlas">) {
  return (
    <Suspense
      fallback={
        <p role="status" className="atlas absolute inset-0 grid place-items-center text-sm text-[var(--ink-dim)]">
          Loading the Atlas…
        </p>
      }
    >
      <Body searchParams={props.searchParams} />
    </Suspense>
  );
}
