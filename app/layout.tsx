import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { DataStatusBanner } from "@/components/DataStatusBanner";
import { NavLink } from "@/components/NavLink";
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
        <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
          <nav
            aria-label="Main"
            className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-2 px-4 py-2.5"
          >
            <Link href="/" className="mr-4 flex items-center gap-2 text-base font-semibold tracking-tight">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
                <path d="M12 3a9 9 0 0 0 0 18 6 6 0 0 1 0-18Z" fill="currentColor" />
              </svg>
              LunaScope
            </Link>
            <NavLink href="/analyze">New analysis</NavLink>
            <NavLink href="/why-the-south-pole-is-hard">Why the south pole is hard</NavLink>
            <span className="ml-auto flex items-center gap-4">
              <ViewModeToggle />
              <span className="hidden text-xs text-muted lg:inline">Screening and education tool</span>
            </span>
          </nav>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:py-12">
          {children}
        </main>
        <footer className="border-t border-border bg-surface px-4 py-6 text-center text-xs leading-5 text-muted">
          <p className="mx-auto max-w-3xl">
            Not flight-qualified. Does not certify landing safety, electrical power, link performance or mission
            feasibility. Not endorsed by NASA. Data: JPL Horizons, LRO LOLA, NAIF SPICE.
          </p>
        </footer>
      </body>
    </html>
  );
}
