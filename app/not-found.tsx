import { Compass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <Empty className="surface-card mx-auto max-w-xl">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Compass aria-hidden="true" />
        </EmptyMedia>
        <h1 className="text-lg font-medium tracking-tight">This page is not here</h1>
        <EmptyDescription>
          The address may be mistyped, or an old link. Nothing was lost: you can start from Home, or set up a new analysis.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        <Button asChild>
          <Link href="/">Go to Home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/analyze">New analysis</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
