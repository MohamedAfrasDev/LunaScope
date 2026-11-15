"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";

/**
 * Last-resort screen for an unexpected failure while drawing a page. It says what happened and what to do, shows no
 * technical detail, and never claims a result. (The service being unreachable is handled inline, not here.)
 */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Empty role="alert" className="surface-card mx-auto max-w-xl">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleAlert aria-hidden="true" />
        </EmptyMedia>
        <h1 className="text-lg font-medium tracking-tight">Something went wrong on this page</h1>
        <EmptyDescription>
          The page could not be drawn. No result was changed or lost. Try again, or go back to Home.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/">Go to Home</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
