import { Compass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main id="main" className="atlas grid min-h-svh place-items-center bg-black px-4">
      <div className="atlas-panel atlas-prose max-w-md p-6 text-center">
        <Compass aria-hidden="true" className="mx-auto mb-3 size-6 text-[var(--ink-dim)]" />
        <h1 className="text-lg font-medium tracking-tight">This page is not here</h1>
        <p className="mt-2 text-sm text-[var(--ink-dim)]">The address may be mistyped, or an old link. Nothing was lost: open the Atlas to carry on.</p>
        <p className="mt-5 flex justify-center gap-6 text-sm">
          <Link href="/atlas" className="tap text-[var(--ink)] underline underline-offset-4">Open the Atlas</Link>
          <Link href="/" className="tap text-[var(--ink)] underline underline-offset-4">Home</Link>
        </p>
      </div>
    </main>
  );
}
