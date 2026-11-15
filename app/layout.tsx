import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { DataStatusAlert, DataStatusProvider } from "@/components/DataStatusBanner";
import { AmbientToggle } from "@/components/AmbientToggle";
import { AppSidebar } from "@/components/shell/AppSidebar";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { ShellBar } from "@/components/shell/ShellBar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "LunaScope", template: "%s · LunaScope" },
  description:
    "Terrain-aware lunar power and direct-to-Earth opportunity navigator. A screening and education tool, not a certification.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-card focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <div className="backdrop" aria-hidden="true">
          <div className="backdrop-stars" />
        </div>
        <DataStatusProvider>
          <TooltipProvider>
            <SidebarProvider>
              <AppSidebar />
              <Suspense fallback={null}>
                <CommandPalette />
              </Suspense>
              <SidebarInset className="min-w-0">
                <DataStatusAlert />
                <ShellBar />
                <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-12">
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
          </TooltipProvider>
        </DataStatusProvider>
      </body>
    </html>
  );
}
