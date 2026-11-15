import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { DataStatusAlert, DataStatusPill, DataStatusProvider } from "@/components/DataStatusBanner";
import { AmbientToggle } from "@/components/AmbientToggle";
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
        <div className="backdrop" aria-hidden="true">
          <div className="backdrop-stars" />
        </div>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-card focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <DataStatusProvider>
        <DataStatusAlert />
        <header className="sticky top-0 z-40 chrome-glass border-b border-border">
          <nav
            aria-label="Main"
            className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1.5 px-4 py-2 sm:py-2.5"
          >
            <Link href="/" className="order-1 mr-4 flex items-center gap-2 text-base font-semibold tracking-tight sm:order-none">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
                <path d="M12 3a9 9 0 0 0 0 18 6 6 0 0 1 0-18Z" fill="currentColor" />
              </svg>
              LunaScope
            </Link>
            {/* On a phone: brand and view switch on the first row, the two links on the second, the data status on the third. */}
            <div className="order-3 flex w-full items-center gap-1 sm:order-none sm:w-auto">
              <NavLink href="/analyze">New analysis</NavLink>
              <NavLink href="/why-the-south-pole-is-hard">Why the south pole is hard</NavLink>
            </div>
            <span className="contents sm:ml-auto sm:flex sm:flex-wrap sm:items-center sm:gap-3">
              <div className="order-4 sm:order-none">
                <DataStatusPill />
              </div>
              <div className="order-2 ml-auto sm:order-none sm:ml-0">
                <ViewModeToggle />
              </div>
            </span>
          </nav>
        </header>
        </DataStatusProvider>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:py-14">
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
      </body>
    </html>
  );
}
