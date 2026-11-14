import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalyzeForm } from "@/components/AnalyzeForm";
import { EvidencePanel } from "@/components/EvidencePanel";
import { ReferenceMissionButton } from "@/components/ReferenceMissionButton";
import { StatusMatrix } from "@/components/StatusMatrix";
import { AvailabilityBar, TimelineChart } from "@/components/TimelineChart";
import type { MatrixRow } from "@/lib/api/types";
import { loadDraft } from "@/lib/draft";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const RUN = "e".repeat(64);
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { "content-type": "application/json" } });
afterEach(() => {
  vi.unstubAllGlobals();
  push.mockReset();
});

// ----------------------------------------------------------------------------- Evidence
const card = (id: string, status: string, site = "rule-89.5S-E0") => ({ id, title: id, status, site_id: site, target: null, facts: ["f"], scope: "s" });
const validation = {
  run_id: RUN, result_state: "real_data_unverified", scopes_closed: [], note: "A met card supports one narrow claim.",
  summary: { met: 3, not_met: 1, not_evaluated: 1 },
  cards: [card("geometry_agreement", "met"), card("interpolation_holdout", "met"), card("horizon_certification", "met"),
    card("independent_terrain_check", "not_evaluated"), card("horizon_convergence", "not_met")],
  groups: [
    { id: "geometry", title: "Sun and Earth geometry", status: "met", scope: "directions only", card_ids: ["geometry_agreement", "interpolation_holdout"], counts: { met: 2, not_met: 0, not_evaluated: 0 } },
    { id: "terrain_horizon", title: "Terrain horizon", status: "not_evaluated", scope: "skyline", card_ids: ["horizon_certification", "dem_release_sensitivity", "independent_terrain_check"], counts: { met: 1, not_met: 0, not_evaluated: 1 } },
    { id: "numerical_convergence", title: "Numerical convergence", status: "not_met", scope: "azimuth", card_ids: ["horizon_convergence"], counts: { met: 0, not_met: 1, not_evaluated: 0 } },
  ],
};
const provenance = {
  run_id: RUN, result_id: "f".repeat(64), algorithm_id: "lunascope-science/x", result_state: "real_data_unverified", verified: false,
  validated_scopes: [],
  request: { mission: { start_utc: "2027-01-10T00:00:00Z", duration_s: 604800, step_s: 600 },
    requirements: { sun_min_availability: 0.6, earth_min_availability: 0.5 },
    terrain: { dem_profile: "lola-80s-20m-adj", radius_km: 150, az_step_deg: 0.1, observer_height_m: 2, clearance_margin_deg: 0 } },
  effective_settings: { eps_deg: 0.01, tau_s: 1, w_min_s: 5, interpolation: "cubic_hermite_enu_vectors" },
  resources: [{ role: "dem", sha256: "09b7ca80f9e6a146f970225d18af72fc02787669b3ef51b888e347d2b6845649" }],
  sites: [{ site_id: "rule-89.5S-E0", observer: { ground_height_m: -722, lat_deg: -89.5, lon_deg_east: 0, body_frame: "MOON_ME", reference_radius_km: 1737.4, observer_height_above_ground_m: 2 },
    horizon: { cache_key: "a".repeat(64), payload_sha256: "b".repeat(64), sectors: { certified: 3600, coverage_limited: 0, unsupported: 0 }, settings: { radius_km: 150, az_step_deg: 0.1 }, skyline_min_deg: -0.2, skyline_max_deg: 9.6 },
    geometry: { sun_center: { provider: "jpl-horizons", raw_sha256: "c".repeat(64), correction_mode: "horizons_apparent_airless_quantity4", time_scale: "UTC (Horizons UT)",
      holdout: { max_deg: 1e-8, n: 361, truth_step_s: 60 }, reference_agreement: { max_total_arcsec: 0.0017, tolerance_arcsec: 0.01, within_tolerance: true } } },
    warnings: ["UNVERIFIED"], caveats: ["Screening and education only."] }],
};

describe("Evidence workspace", () => {
  it("shows the three validation cards with icon+word status, provenance, method and the investigative export", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => json(String(u).includes("/validation") ? validation : provenance)));
    render(<EvidencePanel runId={RUN} />);
    const cards = await screen.findAllByRole("article", { name: /geometry|Terrain horizon|Numerical convergence/ });
    expect(cards).toHaveLength(3);
    expect(within(cards[0]).getAllByText("Met")[0].closest("div")).toContainElement(within(cards[0]).getByRole("heading"));
    expect(within(cards[1]).getAllByText("Not evaluated")[0].closest("div")).toContainElement(within(cards[1]).getByRole("heading")); // an unrun check is never shown as met
    expect(within(cards[2]).getAllByText("Not met")[0].closest("div")).toContainElement(within(cards[2]).getByRole("heading"));
    expect(screen.getByText("Decision band ε")).toBeInTheDocument();
    expect(screen.getByText("150 km")).toBeInTheDocument();
    expect(screen.getByText(/independent SPICE check max 0\.0017″/)).toBeInTheDocument();
    expect(screen.getByText(/frame MOON_ME/)).toBeInTheDocument();
    const dl = screen.getByRole("link", { name: /Download investigative bundle/ });
    expect(dl).toHaveAttribute("href", `/api/v1/analyses/${RUN}/export`);
    expect(screen.getByText(/a verified export is refused/)).toBeInTheDocument();
  });

  it("still shows provenance when the cards cannot be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u: string) => (String(u).includes("/validation")
      ? json({ error: { code: "INTERNAL", message: "x", field: null, retryable: false, correlation_id: null } }, 500)
      : json(provenance))));
    render(<EvidencePanel runId={RUN} />);
    expect(await screen.findByText(/could not be loaded; provenance is still shown/)).toBeInTheDocument();
    expect(screen.getByText("lunascope-science/x")).toBeInTheDocument();
  });
});

// ----------------------------------------------------------------------------- Run summary
const mrow = (id: string, status: MatrixRow["site_status"]): MatrixRow => {
  const c = { outcome: "FAIL" as const, availability_lower: 0, availability_upper: 0, threshold: 0.6 };
  return { site_id: id, site_status: status, targets: { sun_center: { terrain: c, flat: c }, earth_center: { terrain: c, flat: c } } };
};

describe("StatusMatrix excluded group", () => {
  it("keeps undecided sites out of the matrix and lists them as excluded, not failed", () => {
    render(<StatusMatrix runId={RUN} rows={[mrow("rule-89.5S-E0", "FAIL_SUN"), mrow("rule-89.5S-E120", "UNKNOWN_COVERAGE")]} />);
    const table = screen.getByRole("table");
    expect(within(table).queryByText("89.5°S, 120°E")).toBeNull();
    const group = screen.getByRole("region", { name: "Excluded sites" });
    expect(within(group).getByText(/not enough data to decide \(1\)/)).toBeInTheDocument();
    expect(within(group).getByText(/not counted as\s+failures/)).toBeInTheDocument();
    expect(within(group).getByRole("link", { name: "see why on the timeline" })).toHaveAttribute(
      "href", `/runs/${RUN}/timeline/rule-89.5S-E120`);
  });
});

// ----------------------------------------------------------------------------- Timeline
describe("Timeline additions", () => {
  it("draws the requirement as a threshold line and names the bound in the text alternative", () => {
    render(<AvailabilityBar lower={0.745} upper={0.7469} threshold={0.5} label="Earth, terrain-aware" />);
    expect(screen.getByRole("img", { name: "Earth, terrain-aware: availability 74.5% to 74.7%, requirement at least 50.0%" })).toBeInTheDocument();
    expect(screen.getByText("needs 50.0%")).toBeInTheDocument();
  });

  it("marks the longest known outage above its band", () => {
    const iv = (cls: "V" | "H", a: number, b: number) => ({ start_s: a, end_s: b, class: cls, start_utc: "2027-01-10T00:00:00.000Z", end_utc: "2027-01-10T00:00:00.000Z" });
    const { container } = render(<TimelineChart title="t" bands={[{ target: "sun_center", horizon: "terrain", summary: "s",
      intervals: [iv("V", 0, 3600), iv("H", 3600, 86400)], events: [], mark: { start_s: 3600, end_s: 86400, text: "Longest known outage: 23 h" } }]} />);
    expect(Array.from(container.querySelectorAll("title")).map((t) => t.textContent)).toContain("Longest known outage: 23 h");
  });
});

// ----------------------------------------------------------------------------- Home
const gr001 = {
  reference_id: "GR-001", status: "draft", frozen: null, sites_status: "DECLARED REFERENCE SCENARIO",
  request: { schema_version: "1", mission: { start_utc: "2027-01-10T00:00:00Z", duration_s: 604800, step_s: 600 },
    requirements: { sun_min_availability: 0.6, earth_min_availability: 0.5 },
    terrain: { dem_profile: "lola-80s-20m-adj", radius_km: 150, az_step_deg: 0.1, observer_height_m: 2 },
    sites: [{ site_id: "a" }, { site_id: "b" }, { site_id: "c" }], options: { sensitivity: true } },
};

describe("Home reference mission, frozen", () => {
  it("says the reference is frozen and still says its sites are not candidates", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ ...gr001, status: "frozen", frozen: { run_id: "a".repeat(64) } })));
    render(<ReferenceMissionButton />);
    expect(await screen.findByText(/GR-001 is frozen: its inputs and settings cannot change, and any change would be a new reference version/)).toBeInTheDocument();
    expect(screen.getByText(/rule-chosen points, not candidate landing sites/)).toBeInTheDocument();
    expect(screen.queryByText(/is a draft/)).toBeNull();
  });
});

describe("Home reference mission", () => {
  it("submits the GR-001 request exactly and says it is a draft with demonstration sites", async () => {
    const posts: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        posts.push(JSON.parse(String(init.body)));
        return json({ run_id: RUN }, 202);
      }
      return json(gr001);
    }));
    render(<ReferenceMissionButton />);
    expect(await screen.findByText(/Reference GR-001: 7 days from 2027-01-10 UTC.*3 sites, with sensitivity checks/)).toBeInTheDocument();
    expect(screen.getByText(/GR-001 is a draft\. Its three sites are rule-chosen points, not candidate landing sites/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start the reference mission" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/runs/${RUN}`));
    expect(posts).toEqual([gr001.request]);
  });
});

// ----------------------------------------------------------------------------- Mission / Sites
const sites = {
  note: "Rule-chosen demonstration points.",
  sites: [{ site_id: "rule-89.5S-E0", label: "x", lat_deg: -89.5, lon_east_deg: 0, convention: "planetocentric", source: "rule",
    precision_m: 100, kind: "demonstration_rule", dem_coverage_150km: { covered_fraction: 1, fully_covered: true, sectors_with_gap: 0, radius_km: 150 } }],
};

describe("Analysis form: custom-site coverage and the draft", () => {
  it("checks a custom point's terrain coverage and keeps the source point separate", async () => {
    const posts: { url: string; body: unknown }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
      if (String(u).includes("sites/custom")) {
        posts.push({ url: String(u), body: JSON.parse(String(init?.body)) });
        return json({ lat_deg: -85, lon_east_deg: 315, convention: "planetocentric", source: "paper", precision_m: 50,
          source_point_kept_separate: { lon_deg: 45, lon_direction: "west_positive" },
          dem_coverage_150km: { covered_fraction: 0.62, fully_covered: false, sectors_with_gap: 140, radius_km: 150 } });
      }
      return json(sites);
    }));
    render(<AnalyzeForm />);
    fireEvent.click(await screen.findByRole("button", { name: "Add a custom point" }));
    const btn = screen.getByRole("button", { name: "Check terrain coverage for point 1" });
    expect(btn).toBeDisabled(); // nothing is sent for an incomplete point
    fireEvent.change(screen.getByLabelText("Latitude (°)"), { target: { value: "-85" } });
    fireEvent.change(screen.getByLabelText("Longitude (°)"), { target: { value: "45" } });
    fireEvent.change(screen.getByLabelText("Longitude direction"), { target: { value: "west_positive" } });
    fireEvent.change(screen.getByLabelText("Source note"), { target: { value: "paper" } });
    fireEvent.change(screen.getByLabelText("Precision (m)"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Check terrain coverage for point 1" }));
    expect(await screen.findByText(/Analysis point -85\.00000°, 315\.00000° E/)).toBeInTheDocument();
    expect(screen.getByText(/source point 45° west positive\s+is kept separately/)).toBeInTheDocument();
    expect(screen.getByText(/62\.0% of the 150 km footprint.*140 azimuth sector\(s\) will be unknown, not flat/)).toBeInTheDocument();
    expect(posts[0].body).toMatchObject({ lat_deg: -85, lon_deg: 45, lon_direction: "west_positive", convention: "planetocentric" });
    // a later edit makes the shown result stale, so it disappears instead of describing other inputs
    fireEvent.change(screen.getByLabelText("Latitude (°)"), { target: { value: "-86" } });
    expect(screen.queryByText(/Analysis point -85/)).toBeNull();
  });

  it("keeps the draft for this tab and resets to the reference mission on request", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(sites)));
    const { unmount } = render(<AnalyzeForm />);
    const radius = await screen.findByLabelText(/Horizon radius/);
    fireEvent.change(radius, { target: { value: "120" } });
    expect(loadDraft()?.radiusKm).toBe("120");
    unmount();
    render(<AnalyzeForm />);
    expect(await screen.findByLabelText(/Horizon radius/)).toHaveValue("120");
    fireEvent.click(screen.getByRole("button", { name: "Reset to the reference mission" }));
    expect(screen.getByLabelText(/Horizon radius/)).toHaveValue("150");
    expect(loadDraft()).toBeNull();
  });
});
