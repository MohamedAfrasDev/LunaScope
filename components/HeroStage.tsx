import Image from "next/image";
import type { ReactNode } from "react";
import hero from "@/app/images/hero-2400.jpg";

/**
 * The Home hero's stage (galaxy D10a): a calm night view behind the introduction.
 *
 * - The picture is a 2400 px copy (about 270 KB) served through next/image (AVIF/WebP, responsive, blur placeholder);
 *   the 22.7 MB original is never imported.
 * - It is decoration: empty alt text, no motion, never inside a result frame. A visible label says what it is.
 * - A dark scrim keeps the text readable wherever the picture is bright, and the stage always uses the night palette
 *   (`theme-night`), so the page text is light-on-dark in the light theme too. Data panels stay opaque.
 */
export function HeroStage({ children }: { children: ReactNode }) {
  return (
    <div className="theme-night relative isolate overflow-hidden rounded-2xl border border-border bg-background text-foreground">
      <Image
        src={hero}
        alt=""
        fill
        priority
        placeholder="blur"
        sizes="(min-width: 1152px) 1152px, 100vw"
        className="-z-20 object-cover"
        style={{ objectPosition: "30% 40%" }}
      />
      <div aria-hidden="true" className="hero-scrim absolute inset-0 -z-10" />
      <div className="p-6 sm:p-10 lg:p-12">{children}</div>
      <p className="absolute bottom-3 right-3 rounded-full bg-background/80 px-2.5 py-1 text-xs text-muted-foreground">
        Background: illustration only. Not NASA imagery, not data.
      </p>
    </div>
  );
}
