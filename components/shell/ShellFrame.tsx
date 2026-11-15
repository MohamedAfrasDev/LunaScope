import { Suspense, type ReactNode } from "react";
import { DataStatusAlert } from "@/components/DataStatusBanner";
import { AmbientToggle } from "@/components/AmbientToggle";
import { AppSidebar } from "@/components/shell/AppSidebar";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { ShellBar } from "@/components/shell/ShellBar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";

/**
 * The shell the analysis pages sit in: sidebar, top bar, footer. It is a layout of the `(shell)` route group, so the
 * choice between this and the full-screen frame (landing and Atlas, `(bare)`) is made by the folder, never by reading the
 * URL at runtime.
 */
export function ShellFrame({ children }: { children: ReactNode }) {
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
