import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalyzeForm } from "@/components/AnalyzeForm";
import { ReferenceRunCard } from "@/components/ReferenceRunCard";
import { defaultSiteIds, MAX_SITES } from "@/lib/draft";
import { siteLabel } from "@/lib/format";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const RUN = "d".repeat(64);
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { "content-type": "application/json" } });
afterEach(() => {
  vi.unstubAllGlobals();
  push.mockReset();
});

const gr002 = {
  reference_id: "GR-002", status: "draft", frozen: null, sites_status: "named places", title: "Artemis III candidate-region features",
  purpose: "Compare the named features nearest to the candidate regions.",
  request: { schema_version: "1", mission: { start_utc: "2027-01-10T00:00:00Z", duration_s: 604800, step_s: 600 },
    requirements: { sun_min_availability: 0.6, earth_min_availability: 0.5 }, terrain: {},
    sites: [{ site_id: "iau-haworth" }, { site_id: "iau-mons-malapert" }], options: { sensitivity: true } },
};

describe("site labels", () => {
  it("names the IAU places from the catalog, keeps the rule-point format, and leaves unknown ids alone", () => {
    expect(siteLabel("iau-haworth")).toBe("Haworth");
    expect(siteLabel("iau-mons-malapert")).toBe("Mons Malapert");
    expect(siteLabel("iau-de-gerlache")).toBe("de Gerlache");
    expect(siteLabel("rule-89.5S-E0")).toBe("89.5°S, 0°E");
    expect(siteLabel("custom-89p5S_10p0E")).toBe("custom-89p5S_10p0E");
  });
});

describe("notable places card", () => {
  it("shows the named sites and the not-a-recommendation wording, and submits the definition exactly", async () => {
    const posts: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        posts.push(JSON.parse(String(init.body)));
        return json({ run_id: RUN }, 202);
      }
      return json(gr002);
    }));
    render(<ReferenceRunCard refId="GR-002" buttonLabel="Compare the Artemis III features" />);
    expect(await screen.findByText("Artemis III candidate-region features")).toBeInTheDocument();
    expect(screen.getByText("Haworth, Mons Malapert")).toBeInTheDocument();
    expect(screen.getByText(/not landing\s+recommendations/)).toBeInTheDocument();
    expect(screen.getByText(/crater centre is its floor, not its rim/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Compare the Artemis III features" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/atlas?run=${RUN}`));
    expect(posts).toEqual([gr002.request]);
  });

  it("says so in words when the service refuses (for example an unsaved request on the hosted copy)", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) =>
      init?.method === "POST"
        ? json({ error: { code: "REPLAY_ONLY", message: "offline copy", details: [] } }, 409)
        : json(gr002)));
    render(<ReferenceRunCard refId="GR-002" buttonLabel="Go" />);
    fireEvent.click(await screen.findByRole("button", { name: "Go" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("analysis form: grouped catalog", () => {
  it("lists named places under their group with feature type, size, coordinates and the IAU entry", async () => {
    const cov = { covered_fraction: 1, fully_covered: true, sectors_with_gap: 0, radius_km: 150 };
    vi.stubGlobal("fetch", vi.fn(async () => json({
      note: "n", groups: { artemis_iii_regions: "Artemis III candidate-region features" },
      sites: [
        { site_id: "rule-89.5S-E0", label: "x", lat_deg: -89.5, lon_east_deg: 0, convention: "planetocentric", source: "rule", precision_m: 100, kind: "demonstration_rule", dem_coverage_150km: cov },
        { site_id: "iau-haworth", label: "Haworth (crater centre)", name: "Haworth", group: "artemis_iii_regions", lat_deg: -87.45, lon_east_deg: 354.83,
          convention: "planetocentric", source: "IAU", precision_m: 1000, kind: "named_feature_iau", feature_type: "Crater, craters", diameter_km: 51.4,
          iau_url: "https://planetarynames.wr.usgs.gov/Feature/14502", dem_coverage_150km: cov },
      ],
    })));
    render(<AnalyzeForm />);
    expect(await screen.findByRole("heading", { name: "Artemis III candidate-region features" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Demonstration points/ })).toBeInTheDocument();
    expect(screen.getByText(/Crater, 51.4 km across; -87.45°, 354.83°E/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "IAU entry" })).toHaveAttribute("href", "https://planetarynames.wr.usgs.gov/Feature/14502");
  });
});

describe("the form's default selection", () => {
  const cov = { covered_fraction: 1, fully_covered: true, sectors_with_gap: 0, radius_km: 150 };
  const demo = ["rule-89.5S-E0", "rule-89.5S-E120", "rule-89.5S-E240"].map((id) => ({
    site_id: id, label: id, lat_deg: -89.5, lon_east_deg: 0, convention: "planetocentric", source: "rule", precision_m: 100,
    kind: "demonstration_rule", dem_coverage_150km: cov }));
  const named = Array.from({ length: 12 }, (_, i) => ({
    site_id: `iau-place-${i}`, label: `Place ${i}`, name: `Place ${i}`, group: "g", lat_deg: -87, lon_east_deg: i, convention: "planetocentric",
    source: "IAU", precision_m: 1000, kind: "named_feature_iau", dem_coverage_150km: cov }));

  it("starts with the demonstration points only, never more than a run allows", () => {
    const ids = defaultSiteIds([...demo, ...named]);
    expect(ids).toEqual(demo.map((d) => d.site_id));
    expect(ids.length).toBeLessThanOrEqual(MAX_SITES);
    // a catalog with no demonstration points still never exceeds the limit
    expect(defaultSiteIds(named).length).toBe(MAX_SITES);
  });

  it("opens with three sites ticked and no error, even though the catalog holds fifteen", async () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async () => json({ note: "n", groups: { g: "Named" }, sites: [...demo, ...named] })));
    render(<AnalyzeForm />);
    await screen.findByRole("heading", { name: "Named" });
    const ticked = screen.getAllByRole("checkbox").filter((c) => (c as HTMLInputElement).checked);
    expect(ticked.length).toBe(3);
    fireEvent.click(screen.getByRole("button", { name: /Run analysis/ }));
    await waitFor(() => expect(screen.queryByText(/Fix \d+ field/)).toBeNull());
  });
});
