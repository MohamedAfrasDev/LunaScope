import type { Metadata } from "next";
import { AtlasShell } from "@/components/atlas/AtlasShell";

export const metadata: Metadata = { title: "Atlas" };

/** The new layout (docs/redesign/LAYOUT-SPEC.md). Lives in the (bare) route group, so it has no sidebar shell. */
export default function AtlasPage() {
  return <AtlasShell />;
}
