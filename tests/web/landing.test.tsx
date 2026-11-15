import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataStatusProvider } from "@/components/DataStatusBanner";

vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: () => {} }) }));
vi.mock("@/components/ReferenceMissionButton", () => ({ ReferenceMissionButton: () => <button type="button">Start the reference mission</button> }));
vi.mock("@/components/ReferenceRunCard", () => ({ ReferenceRunCard: ({ buttonLabel }: { buttonLabel: string }) => <button type="button">{buttonLabel}</button> }));

const { LandingHero } = await import("@/components/landing/LandingHero");
const { LandingMoon } = await import("@/components/landing/LandingMoon");
const { default: Home } = await import("@/app/(bare)/page");

beforeEach(() => {
  window.matchMedia =
    window.matchMedia ??
    ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList);
  window.ResizeObserver = window.ResizeObserver ?? (class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver);
});

describe("LandingHero", () => {
  it("is the wordmark, one line and one button, with the picture credited and labelled illustrative", () => {
    render(
      <DataStatusProvider>
        <LandingHero />
      </DataStatusProvider>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "LunaScope" })).toBeInTheDocument();
    expect(screen.getByText(/Terrain-aware sunlight and Earth visibility/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enter" })).toHaveAttribute("href", "/atlas");
    expect(screen.getByText(/NASA\/GSFC\/ASU, LRO WAC mosaic/)).toBeInTheDocument();
    expect(screen.getByText(/Lighting is illustrative/)).toBeInTheDocument();
    expect(screen.getByText("ILLUSTRATION")).toBeInTheDocument();
  });

  it("always shows what the numbers are: the data-status pill is on the first screen", () => {
    render(
      <DataStatusProvider>
        <LandingHero />
      </DataStatusProvider>,
    );
    // until the service answers the pill says it is checking; once it answers it names the data (see data-status.test.tsx)
    expect(screen.getByText("Checking the science service…")).toBeInTheDocument();
  });
});

describe("LandingMoon", () => {
  it("falls back to a still, named picture when WebGL is not available", async () => {
    render(<LandingMoon />);
    await waitFor(() => expect(screen.getByTestId("landing-moon")).toHaveAttribute("data-fallback", "true"));
    expect(screen.getByRole("img", { name: /The Moon, an illustration/ })).toBeInTheDocument();
  });
});

describe("Landing page", () => {
  it("has one h1, the idea, the three rules and the limits, and keeps the saved runs reachable", () => {
    render(
      <DataStatusProvider>
        <Home />
      </DataStatusProvider>,
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText(/Is the Sun or Earth above the terrain/)).toBeInTheDocument();
    expect(screen.getByText(/No placeholder is shown as science/)).toBeInTheDocument();
    expect(screen.getByText(/Unknown is not/)).toBeInTheDocument();
    expect(screen.getByText(/No hidden score/)).toBeInTheDocument();
    expect(screen.getByText(/Not a landing-safety, power, link-budget/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start the reference mission" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Set up your own analysis" })).toBeNull(); // the Atlas has the Analyse panel
    expect(screen.getByRole("link", { name: "Open the Atlas" })).toHaveAttribute("href", "/atlas");
    expect(screen.getAllByText(/Not endorsed by NASA/).length).toBeGreaterThan(0);
  });
});
