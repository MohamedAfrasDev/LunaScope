import Link from "next/link";
import { DataStatusPill } from "@/components/DataStatusBanner";
import { LandingMoon } from "@/components/landing/LandingMoon";
import { Tag } from "@/components/atlas/Tag";

/**
 * The landing's first screen (spec 6.1): the Moon, a wordmark, one line, one button. Nothing else competes with it.
 * The picture is NASA imagery with illustrative lighting, and says so. It is never a result.
 */
export function LandingHero() {
  return (
    <section aria-label="LunaScope" className="relative isolate h-svh min-h-[34rem] overflow-hidden">
      <LandingMoon />
      {/* keeps the words readable wherever the picture is bright */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgb(5_5_7/0.85)_0%,rgb(5_5_7/0.35)_45%,transparent_70%)]" />

      {/* what the numbers are, always in view (the same pill as every other page) */}
      <div className="absolute right-4 top-4 sm:right-8">
        <DataStatusPill />
      </div>

      <div className="absolute inset-x-0 bottom-0 px-6 pb-16 sm:px-12 sm:pb-20 lg:px-[6.5rem]">
        <span aria-hidden="true" className="mb-6 block h-0.5 w-24 bg-[var(--select)]" />
        <h1 className="text-[clamp(2rem,7vw,4.75rem)] font-extralight uppercase leading-none tracking-[0.26em] text-[var(--ink)]">
          LunaScope
        </h1>
        <p className="atlas-label-lg mt-5 max-w-xl text-[var(--ink-dim)]">
          Terrain-aware sunlight and Earth visibility at the lunar south pole
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href="/atlas"
            className="atlas-label-lg inline-flex min-h-11 items-center border border-[var(--panel-edge)] border-l-2 border-l-[var(--select)] bg-[var(--panel)] px-8 text-[var(--ink)] transition-colors hover:bg-[var(--panel-raised)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--select)]"
          >
            Enter
          </Link>
          <a href="#idea" className="tap atlas-label inline-flex items-center text-[var(--ink-dim)] underline-offset-4 hover:text-[var(--ink)] hover:underline">
            How it works
          </a>
        </div>
      </div>

      <p className="atlas-label absolute bottom-4 right-4 flex max-w-[18rem] flex-col items-end gap-2 text-right text-[var(--ink-dim)] sm:right-8">
        <Tag kind="illustration" />
        <span>Moon imagery: NASA/GSFC/ASU, LRO WAC mosaic. Lighting is illustrative.</span>
      </p>
    </section>
  );
}
