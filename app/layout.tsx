import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DataStatusProvider } from "@/components/DataStatusBanner";
import { AppFrame } from "@/components/shell/AppFrame";
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
            <AppFrame>{children}</AppFrame>
          </TooltipProvider>
        </DataStatusProvider>
      </body>
    </html>
  );
}
