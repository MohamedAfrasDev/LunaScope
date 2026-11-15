import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sky3D } from "@/components/Sky3D";
import { MissionWindowPanel } from "@/components/atlas/MissionWindowPanel";
import { Readout } from "@/components/atlas/Readout";
import { SelectedSitePanel } from "@/components/atlas/SelectedSitePanel";
import { SiteSky } from "@/components/atlas/SiteSky";
import { SkyControls } from "@/components/atlas/SkyControls";
import { TopBar } from "@/components/atlas/TopBar";
import type { HorizonProfileResponse, IntervalRow, SkySeries, Target, TargetHorizonResult } from "@/lib/api/types";
import type { RunWindow } from "@/lib/atlas/clock";
import type { Track } from "@/lib/atlas/run";
import { cardinal, facingWords, headingLabel, missionDay, skyScaleLabel, timeLeft, wrap360 } from "@/lib/atlas/sky";
import { fromCatalog } from "@/lib/atlas/sites";
import type { CatalogSite } from "@/lib/api/types";

vi.mock("next/navigation", () => ({ usePathname: () => "/atlas", useRouter: () => ({ push: () => {} }) }));
vi.mock("@/components/shell/CommandPalette", () => ({ openCommandPalette: vi.fn() }));

beforeEach(() => {
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
});

describe("sky words", () => {
  it("names compass points and headings", () => {
    expect(cardinal(0)).toBe("N");
    expect(cardinal(151)).toBe("SE");
    expect(cardinal(359)).toBe("N");
    expect(cardinal(-90)).toBe("W");
    expect(facingWords(151)).toBe("south-east");
    expect(facingWords(180)).toBe("south");
    expect(facingWords(350)).toBe("north");
    expect(headingLabel(151.4)).toBe("151° SE");
    expect(headingLabel(359.8)).toBe("0° N");
    expect(wrap360(-10)).toBe(350);
    expect(wrap360(725)).toBe(5);
  });

  it("states the exaggeration in the scale readout", () => {
    expect(skyScaleLabel(1)).toBe("SITE SKY (1× TRUE)");
    expect(skyScaleLabel(3)).toBe("SITE SKY (3× HEIGHTS)");
  });

  it("counts days from the start of the window and says how long is left", () => {
    const d = 86400;
    expect(missionDay(0, 30 * d)).toEqual({ day: 1, days: 30 });
    expect(missionDay(6 * d + 5, 30 * d)).toEqual({ day: 7, days: 30 });
    expect(missionDay(99 * d, 30 * d)).toEqual({ day: 30, days: 30 });
    expect(missionDay(0, 3600)).toEqual({ day: 1, days: 1 });
    expect(timeLeft(7 * d, 30 * d)).toBe("23 d left");
    expect(timeLeft(7 * d + 3600 * 5, 30 * d)).toBe("22 d 19 h left");
    expect(timeLeft(30 * d, 30 * d)).toBe("ended");
  });
});

describe("SkyControls", () => {
  const base = () => ({
    look: "look" as const, onLook: vi.fn(), exaggeration: 1, onExaggeration: vi.fn(),
    paths: { sun_center: true, earth_center: false } as Record<Target, boolean>, onPaths: vi.fn(),
    onFaceTarget: vi.fn(), onFace: vi.fn(), onReturn: vi.fn(), yaw: 151,
    has: { sun_center: true, earth_center: true } as Record<Target, boolean>,
  });

  it("looks at things, shows paths, and returns to the Moon", () => {
    const p = base();
    render(<SkyControls {...p} />);
    fireEvent.click(screen.getByRole("button", { name: /Return to Moon/ }));
    fireEvent.click(screen.getByRole("button", { name: "Face the Sun" }));
    fireEvent.click(screen.getByRole("button", { name: "Face the Earth" }));
    fireEvent.click(screen.getByRole("button", { name: "Face south" }));
    expect(p.onReturn).toHaveBeenCalledOnce();
    expect(p.onFaceTarget).toHaveBeenNthCalledWith(1, "sun_center");
    expect(p.onFaceTarget).toHaveBeenNthCalledWith(2, "earth_center");
    expect(p.onFace).toHaveBeenCalledWith(180);
    for (const [n, az] of [["north", 0], ["east", 90], ["west", 270]] as const) {
      fireEvent.click(screen.getByRole("button", { name: `Face ${n}` }));
      expect(p.onFace).toHaveBeenLastCalledWith(az);
    }
  });

  it("toggles each path, and All paths turns both on; the state is pressed or not", () => {
    const p = base();
    render(<SkyControls {...p} />);
    expect(screen.getByRole("button", { name: "Sun path" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Earth path" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "All paths" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Earth path" }));
    expect(p.onPaths).toHaveBeenLastCalledWith({ sun_center: true, earth_center: true });
    fireEvent.click(screen.getByRole("button", { name: "Sun path" }));
    expect(p.onPaths).toHaveBeenLastCalledWith({ sun_center: false, earth_center: false });
    fireEvent.click(screen.getByRole("button", { name: "All paths" }));
    expect(p.onPaths).toHaveBeenLastCalledWith({ sun_center: true, earth_center: true });
  });

  it("states the exaggeration whenever it is on, and not otherwise", () => {
    const p = base();
    const { rerender } = render(<SkyControls {...p} />);
    expect(screen.queryByText(/exaggerated/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Exaggerate heights ×3" }));
    expect(p.onExaggeration).toHaveBeenCalledWith(3);
    rerender(<SkyControls {...p} exaggeration={3} />);
    expect(screen.getByRole("button", { name: "Exaggerate heights ×3" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Elevation angles are exaggerated ×3 for legibility. Azimuths and the data are unchanged.");
  });

  it("switches between looking around and viewing from outside when asked to offer both, and shows where the view points", () => {
    const p = base();
    render(<SkyControls {...p} />);
    expect(screen.getByRole("button", { name: "Look around" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "From outside" }));
    expect(p.onLook).toHaveBeenCalledWith("orbit");
    expect(screen.getByTestId("sky-heading")).toHaveTextContent("151° SE");
    expect(screen.getByTestId("sky-heading")).toHaveTextContent("Facing south-east");
  });

  it("shows the Lander toggle only when asked, and it reports its state", () => {
    const props = base();
    const onLander = vi.fn();
    const { rerender } = render(<SkyControls {...props} />);
    expect(screen.queryByRole("button", { name: "Lander" })).toBeNull();
    rerender(<SkyControls {...props} lander onLander={onLander} />);
    expect(screen.getByRole("button", { name: "Lander" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Lander" }));
    expect(onLander).toHaveBeenCalledWith(false);
    rerender(<SkyControls {...props} lander={false} onLander={onLander} />);
    expect(screen.getByRole("button", { name: "Lander" })).toHaveAttribute("aria-pressed", "false");
  });

  it("leaves out the look buttons when none are wanted (the Atlas stands you on the surface)", () => {
    const { onLook: _unused, ...rest } = base();
    void _unused;
    render(<SkyControls {...rest} />);
    expect(screen.queryByRole("button", { name: "From outside" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Look around" })).toBeNull();
    expect(screen.getByRole("button", { name: "Face the Sun" })).toBeInTheDocument();
  });

  it("offers only the targets the site has", () => {
    render(<SkyControls {...base()} has={{ sun_center: true, earth_center: false }} />);
    expect(screen.queryByRole("button", { name: "Face the Earth" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Earth path" })).toBeNull();
    expect(screen.getByRole("button", { name: "Face the Sun" })).toBeInTheDocument();
  });
});

const START = Date.UTC(2026, 10, 15, 7, 3);
const W: RunWindow = { startMs: START, totalS: 30 * 86400 };
const iv = (a: number, b: number, c: IntervalRow["class"]): IntervalRow => ({ start_s: a, end_s: b, start_utc: new Date(START + a * 1000).toISOString(), end_utc: new Date(START + b * 1000).toISOString(), class: c });
function track(lo: number, hi: number): Track {
  const terrain = {
    metrics: { visible_s: 1, hidden_s: 1, unknown_s: 0, availability_lower: lo, availability_upper: hi, known_time_fraction: 1, longest_known_hidden_s: 1, longest_known_hidden_start: 0, longest_known_hidden_end: 1, worst_case_not_visible_s: 0, exclusion_reasons: [], threshold: 0.6, outcome: "PASS", margin_lower: 0.1, margin_upper: 0.1 },
    clearance_at_nodes: null,
    countdown_at_start: { kind: "set", text: "x", remaining_s: null },
    intervals: [iv(0, W.totalS, "V")],
    events: [],
  } as unknown as TargetHorizonResult;
  return { series: { step_s: 600, az_deg: [1, 2], el_deg: [1, 2] } as SkySeries, intervals: terrain.intervals!, events: [], terrain, flat: null };
}
const tracks: Partial<Record<Target, Track>> = { sun_center: track(0.5, 0.52), earth_center: track(1, 1) };

describe("MissionWindowPanel", () => {
  it("says where the clock is in the window and what the service says about each target now and over the whole window", () => {
    render(
      <MissionWindowPanel
        window={W}
        t={6 * 86400 + 7 * 3600}
        tracks={tracks}
        readings={[{ target: "sun_center", azDeg: 1, elDeg: 1, state: "V" }, { target: "earth_center", azDeg: 2, elDeg: 2, state: "H" }]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByTestId("mission-day")).toHaveTextContent("Day 7 of 30");
    expect(screen.getByText("23 d 17 h left")).toBeInTheDocument();
    const region = screen.getByRole("region", { name: "Mission window" });
    expect(region).toHaveTextContent("Sun above the terrain skyline");
    expect(region).toHaveTextContent("Visible");
    expect(region).toHaveTextContent("Hidden by terrain or below the horizon");
    expect(region).toHaveTextContent("Whole window: 50.00–52.00% (needs at least 60%)");
    expect(region).toHaveTextContent("Whole window: 100.00% (needs at least 60%)");
    expect(region).toHaveTextContent(/judged separately/);
    expect(screen.getByTestId("sky-illustration-note")).toHaveTextContent(/ILLUSTRATION.*lander are drawn, not photographed.*Blue Marble.*SDO photograph.*Both are enlarged.*NASA\/GSFC SVS and NASA\/SDO/);
    expect(region).not.toHaveTextContent(/both visible/i); // no combined figure
  });
});

describe("scale wiring", () => {
  const base = { scale: "moon" as const, onScale: vi.fn(), open: [], onTogglePanel: vi.fn(), onView: vi.fn(), placing: false, onTogglePlacing: vi.fn() };

  it("Site sky is off until a site the run holds is selected, and says why", () => {
    const { rerender } = render(<TopBar {...base} />);
    const b = screen.getByRole("button", { name: "Site sky" });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("title", "Select a site that is in the loaded run");
    rerender(<TopBar {...base} skyReady />);
    expect(screen.getByRole("button", { name: "Site sky" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Site sky" }));
    expect(base.onScale).toHaveBeenCalledWith("sky");
  });

  it("the readout can carry extra rows with their tags", () => {
    render(<Readout scaleLabel="SITE SKY (1× TRUE)" timeLabel="2026-11-18 21:48 UTC" extra={[{ label: "Sun", tag: "derived", value: "AZ 128.6° · EL +49.68°" }]} />);
    const r = screen.getByTestId("atlas-readout");
    expect(r).toHaveTextContent("Sun");
    expect(r).toHaveTextContent("AZ 128.6° · EL +49.68°");
    expect(r).toHaveTextContent("DERIVED");
    expect(r).toHaveTextContent("SITE SKY (1× TRUE)");
  });

  it("Enter site sky is on only when the run holds the site", () => {
    const cov = { covered_fraction: 1, fully_covered: true, radius_km: 150, sectors_with_gap: 0 };
    const site = fromCatalog({ site_id: "iau-haworth", label: "Haworth", name: "Haworth", group: "artemis", kind: "named_feature", convention: "planetocentric", dem_coverage_150km: cov, lat_deg: -87.45, lon_east_deg: 354.8, precision_m: 100, source: "IAU" } as CatalogSite);
    const props = { site, onCentre: () => {}, onReset: () => {}, onClose: () => {} };
    const { rerender } = render(<SelectedSitePanel {...props} />);
    expect(screen.getByRole("button", { name: "Enter site sky" })).toBeDisabled();
    const enter = vi.fn();
    rerender(<SelectedSitePanel {...props} onEnterSky={enter} />);
    fireEvent.click(screen.getByRole("button", { name: "Enter site sky" }));
    expect(enter).toHaveBeenCalledOnce();
  });
});

describe("SiteSky without a skyline or without WebGL", () => {
  const common = { siteName: "Haworth", tracks, window: W, t: 0, look: "look" as const, exaggeration: 1, paths: {}, onReady: () => {}, onView: () => {} };

  it("waits in words while the skyline loads, and says so if it failed, drawing nothing", () => {
    const { rerender } = render(<SiteSky {...common} horizon={{ status: "loading" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading the terrain skyline for this site…");
    expect(screen.queryByTestId("site-sky")).toBeNull();
    rerender(<SiteSky {...common} horizon={{ status: "error", message: "Could not reach the web server." }} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/no sky is drawn.*Could not reach the web server/);
  });

  it("Sky3D in the Atlas says plainly that it needs WebGL and points to the flat plots (jsdom has none)", async () => {
    const profile = { site_id: "s", azimuth_deg: [0, 90, 180, 270], horizon_el_deg: [3, 4, 5, null] } as unknown as HorizonProfileResponse;
    render(<Sky3D bleed profile={profile} tracks={[{ target: "sun_center", series: { step_s: 600, az_deg: [1, 2], el_deg: [1, 2] }, intervals: [iv(0, 1200, "H")] }]} t={0} siteName="Haworth" clock="x" />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/needs WebGL.*Sky path panel draws the same sky as flat plots/));
  });
});
