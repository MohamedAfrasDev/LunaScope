"use client";

import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { DataStatusAlert } from "@/components/DataStatusBanner";
import { AmbientToggle } from "@/components/AmbientToggle";
import { AppSidebar } from "@/components/shell/AppSidebar";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { ShellBar } from "@/components/shell/ShellBar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";

/** The Atlas owns the whole screen, so it gets no sidebar, header or footer. Every other route keeps the shell it has today. */
export function isAtlasPath(pathname: string | null): boolean {
  return pathname === "/atlas" || (pathname?.startsWith("/atlas/") ?? false);
}

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (isAtlasPath(pathname)) {
    return (
      <>
        <Suspense fallback={null}>
          <CommandPalette />
        </Suspense>
        <div className="flex h-svh flex-col bg-black">
          <DataStatusAlert />
          <main id="main" className="relative min-h-0 flex-1">
            {children}
          </main>
        </div>
        <Toaster />
      </>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <Suspense fallback={null}>
        <CommandPalette />
      </Suspense>
      <SidebarInset className="min-w-0">
        <DataStatusAlert />
        <ShellBar />
        <main id="main" className="mx-auto min-h-svh w-full max-w-6xl flex-1 px-4 py-8 sm:py-12">
          {children}
        </main>
        <footer className="border-t border-border bg-card px-4 py-6 text-center text-xs leading-5 text-muted-foreground">
          <div className="mb-2 flex justify-center">
            <AmbientToggle />
          </div>
          <p className="mx-auto max-w-3xl">
            Not flight-qualified. Does not certify landing safety, electrical power, link performance or mission
            feasibility. Not endorsed by NASA. Data: JPL Horizons, LRO LOLA, NAIF SPICE.
          </p>
        </footer>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}
