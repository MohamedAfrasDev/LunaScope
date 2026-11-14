import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { DataStatusBanner } from "@/components/DataStatusBanner";
import { ViewModeToggle } from "@/components/ViewMode";
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
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <DataStatusBanner />
        <header className="border-b border-border bg-surface">
          <nav
            aria-label="Main"
            className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3"
          >
            <Link href="/" className="text-lg font-semibold tracking-tight">
              LunaScope
            </Link>
            <Link href="/analyze" className="text-sm text-muted hover:text-foreground">
              New analysis
            </Link>
            <Link href="/why-the-south-pole-is-hard" className="text-sm text-muted hover:text-foreground">
              Why the south pole is hard
            </Link>
            <span className="ml-auto flex items-center gap-4">
              <ViewModeToggle />
              <span className="hidden text-xs text-muted sm:inline">Screening and education tool</span>
            </span>
          </nav>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>
        <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted">
          Not flight-qualified. Does not certify landing safety, electrical power, link performance or mission
          feasibility. Not endorsed by NASA. Data: JPL Horizons, LRO LOLA, NAIF SPICE.
        </footer>
      </body>
    </html>
  );
}
