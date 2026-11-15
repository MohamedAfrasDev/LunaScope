import type { Metadata } from "next";
import { AtlasShell } from "@/components/atlas/AtlasShell";

export const metadata: Metadata = { title: "Atlas" };

/** The new layout (docs/redesign/LAYOUT-SPEC.md). Rendered without the sidebar shell: see AppFrame. */
export default function AtlasPage() {
  return <AtlasShell />;
}
