import { Suspense } from "react";
import { DataStatusAlert } from "@/components/DataStatusBanner";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { Toaster } from "@/components/ui/sonner";

/**
 * The landing and the Atlas own the whole screen: no sidebar, no header, no footer. The service-down strip, search and
 * toasts still work here. `main` takes whatever height the strip leaves, so the Atlas can fill it exactly.
 */
export default function BareLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense fallback={null}>
        <CommandPalette />
      </Suspense>
      <div className="flex min-h-svh flex-col bg-black">
        <DataStatusAlert />
        <main id="main" className="relative flex-1">
          {children}
        </main>
      </div>
      <Toaster />
    </>
  );
}
