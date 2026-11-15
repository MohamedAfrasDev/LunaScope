"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";

/**
 * Last-resort screen for an unexpected failure while drawing a page. It says what happened and what to do, shows no
 * technical detail, and never claims a result. (The service being unreachable is handled inline, not here.)
 */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="atlas grid min-h-svh place-items-center px-4">
      <div className="atlas-panel atlas-prose max-w-md p-6 text-center">
        <CircleAlert aria-hidden="true" className="mx-auto mb-3 size-6 text-[var(--ink-dim)]" />
        <h1 className="text-lg font-medium tracking-tight">Something went wrong on this page</h1>
        <p className="mt-2 text-sm text-[var(--ink-dim)]">The page could not be drawn. No result was changed or lost. Try again, or go back to Home.</p>
        <p className="mt-5 flex justify-center gap-6 text-sm">
          <button type="button" onClick={reset} className="tap text-[var(--ink)] underline underline-offset-4">Try again</button>
          <Link href="/" className="tap text-[var(--ink)] underline underline-offset-4">Go to Home</Link>
        </p>
      </div>
    </div>
  );
}
