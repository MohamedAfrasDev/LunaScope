import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SceneHandle } from "@/components/explore/ExploreViewer";
import { PinLayer } from "@/components/atlas/PinLayer";
import { SelectedSitePanel, analyseHref } from "@/components/atlas/SelectedSitePanel";
import { SitesPanel } from "@/components/atlas/SitesPanel";
import type { Catalog } from "@/components/atlas/useCatalog";
import { decodeShare, SHARE_PARAM } from "@/lib/draft";
import {
  coverageWords,
  declutter,
  filterSites,
  formatEastLon,
  formatLat,
  fromCatalog,
  fromCustomCheck,
  groupSites,
  inTerrainData,
  labelSize,
  normalizeEastLon,

} from "@/lib/atlas/sites";
import type { CatalogSite, CustomSiteCheck } from "@/lib/api/types";

const cov = { covered_fraction: 1, fully_covered: true, radius_km: 150, sectors_with_gap: 0 };
const cat = (o: Partial<CatalogSite> & { site_id: string; label: string }): CatalogSite =>
  ({ convention: "planetocentric", dem_coverage_150km: cov, kind: "named_feature", lat_deg: -87.45, lon_east_deg: 354.8, precision_m: 100, source: "IAU Gazetteer", ...o }) as CatalogSite;

const haworth = fromCatalog(cat({ site_id: "iau-haworth", label: "Haworth (crater centre)", name: "Haworth", group: "artemis", feature_type: "Crater", diameter_km: 51, iau_url: "https://planetarynames.wr.usgs.gov/x" }));
const rule = fromCatalog(cat({ site_id: "rule-89.5S-E0", label: "-89.5 deg, 0 E (rule point)", kind: "demonstration_rule", lat_deg: -89.5, lon_east_deg: 0 }));
const partial = fromCatalog(cat({ site_id: "p", label: "Edge", group: "craters", dem_coverage_150km: { ...cov, fully_covered: false, covered_fraction: 0.92, sectors_with_gap: 3 } }));

describe("site model", () => {
  it("reads the catalog: names win over labels, demonstration points are told apart, longitude is east 0 to 360", () => {
    expect(haworth).toMatchObject({ id: "iau-haworth", label: "Haworth", kind: "named", group: "artemis", featureType: "Crater", diameterKm: 51 });
    expect(rule.kind).toBe("demonstration");
    expect(rule.group).toBe("demonstration");
    expect(normalizeEastLon(-5.2)).toBeCloseTo(354.8);
    expect(normalizeEastLon(360)).toBe(0);
  });

  it("says coordinates plainly", () => {
    expect(formatLat(-87.45)).toBe("87.450° S");
    expect(formatLat(10)).toBe("10.000° N");
    expect(formatEastLon(-5.2)).toBe("354.800° E");
  });

  it("only accepts latitudes the terrain data covers", () => {
    expect(inTerrainData(-80)).toBe(true);
    expect(inTerrainData(-90)).toBe(true);
    expect(inTerrainData(-79.9)).toBe(false);
    expect(inTerrainData(Number.NaN)).toBe(false);
  });

  it("coverage is worded, and unknown stays unknown", () => {
    expect(coverageWords(haworth.coverage)).toMatchObject({ known: true, full: true });
    const p = coverageWords(partial.coverage);
    expect(p.word).toMatch(/92%.*3 direction sectors unknown/);
    expect(p.full).toBe(false);
    const u = coverageWords(null);
    expect(u).toMatchObject({ known: false, full: false });
    expect(u.word).toMatch(/Unknown coverage/);
  });

  it("builds a custom site from the service's check, keeping what the service normalised", () => {
    const check = { lat_deg: -88, lon_east_deg: 45, convention: "planetocentric", source: "Placed", precision_m: 1000, source_point_kept_separate: { lon_deg: 45, lon_direction: "east_positive" }, dem_coverage_150km: cov } as CustomSiteCheck;
    expect(fromCustomCheck(2, check)).toMatchObject({ id: "custom-2", label: "Custom point 2", kind: "custom", latDeg: -88, lonEastDeg: 45, precisionM: 1000 });
  });

  it("groups with demonstration points first and custom points last, and searches by name or type", () => {
    const custom = fromCustomCheck(1, { lat_deg: -88, lon_east_deg: 1, convention: "planetocentric", source: "s", precision_m: 1, source_point_kept_separate: { lon_deg: 1, lon_direction: "east_positive" }, dem_coverage_150km: cov } as CustomSiteCheck);
    const g = groupSites([haworth, custom, rule, partial], { artemis: "Artemis III features", craters: "Craters" } as never);
    expect(g.map((x) => x.id)).toEqual(["demonstration", "artemis", "craters", "custom"]);
    expect(g[1].title).toBe("Artemis III features");
    expect(filterSites([haworth, rule], "hawor")).toEqual([haworth]);
    expect(filterSites([haworth, rule], "crater")).toEqual([haworth]);
    expect(filterSites([haworth, rule], "  ")).toHaveLength(2);
    expect(filterSites([haworth, rule], "zzz")).toEqual([]);
  });
});

describe("declutter", () => {
  const b = (id: string, x: number, y: number, priority = 0) => ({ id, x, y, w: 80, h: 22, priority });
  it("keeps labels that do not touch and drops one that would sit on another", () => {
    const shown = declutter([b("a", 0, 0), b("b", 40, 5), b("c", 300, 0)]);
    expect([...shown].sort()).toEqual(["a", "c"]);
  });
  it("always keeps the highest priority, wherever it is in the list", () => {
    const shown = declutter([b("a", 0, 0, 0), b("sel", 20, 4, 3)]);
    expect(shown.has("sel")).toBe(true);
    expect(shown.has("a")).toBe(false);
  });
  it("no label overlaps another after decluttering (random layouts)", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const boxes = Array.from({ length: 60 }, (_, i) => b(`s${i}`, rnd() * 500, rnd() * 300, Math.floor(rnd() * 3)));
    const shown = declutter(boxes, 4);
    const kept = boxes.filter((x) => shown.has(x.id));
    for (const p of kept) for (const q of kept) if (p !== q) expect(p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h).toBe(false);
  });
  it("sizes a label from its length", () => {
    expect(labelSize(10).w).toBeLessThan(labelSize(20).w);
  });
});

function fakeScene(over: Partial<SceneHandle> = {}) {
  let cb: (() => void) | null = null;
  const handle: SceneHandle = {
    fly: vi.fn(),
    flyToSite: vi.fn(),
    project: vi.fn((lat: number) => ({ x: 200 + lat, y: 200, visible: lat !== -89.5 })),
    pick: vi.fn(() => null),
    onFrame: vi.fn((f: () => void) => {
      cb = f;
      return () => {
        cb = null;
      };
    }),
    setClickHandler: vi.fn(),
    setSunTime: vi.fn(),
    ...over,
  };
  return { handle, frame: () => cb?.() };
}

beforeEach(() => {
  window.matchMedia =
    window.matchMedia ??
    ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList);
});

describe("PinLayer", () => {
  // jsdom has no layout: give every element a 1000 x 800 box so a projected pin counts as inside the view
  beforeEach(() => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, width: 1000, height: 800, top: 0, left: 0, right: 1000, bottom: 800, toJSON: () => ({}) } as DOMRect);
  });
  it("renders a named, focusable button per site, marks the selected one, and reports clicks", () => {
    const { handle } = fakeScene();
    const onSelect = vi.fn();
    render(<PinLayer scene={handle} sites={[haworth, partial]} selectedId="iau-haworth" onSelect={onSelect} />);
    const pin = screen.getByRole("button", { name: /Haworth, 87\.450° S, 354\.800° E/ });
    expect(pin).toHaveAttribute("aria-pressed", "true");
    expect(pin).toHaveAttribute("data-coverage", "full");
    expect(screen.getByRole("button", { name: /Edge/ })).toHaveAttribute("data-coverage", "partial");
    fireEvent.click(pin);
    expect(onSelect).toHaveBeenCalledWith("iau-haworth");
  });

  it("positions a pin from the scene, hides one the Moon hides, and follows every frame", async () => {
    const { handle, frame } = fakeScene();
    render(<PinLayer scene={handle} sites={[haworth, rule]} selectedId={null} onSelect={() => {}} />);
    // jsdom has no layout, so the container is 0x0: pins are inside only if the test gives it a size
    const layer = screen.getByTestId("pin-layer");
    layer.getBoundingClientRect = () => ({ x: 0, y: 0, width: 1000, height: 800, top: 0, left: 0, right: 1000, bottom: 800, toJSON: () => ({}) }) as DOMRect;
    frame();
    const h = screen.getByRole("button", { name: /Haworth/ });
    await waitFor(() => expect(h.style.transform).toContain("translate("));
    expect(h.style.display).toBe("");
    expect((layer.querySelector('[data-site="rule-89.5S-E0"]') as HTMLElement).style.display).toBe("none"); // far side
  });

  it("draws unknown coverage as unknown, never as covered", () => {
    const { handle } = fakeScene();
    render(<PinLayer scene={handle} sites={[{ ...haworth, coverage: null }]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /Haworth/ })).toHaveAttribute("data-coverage", "unknown");
  });
});

describe("SelectedSitePanel", () => {
  const props = { onCentre: vi.fn(), onReset: vi.fn(), onClose: vi.fn() };

  it("shows where the point comes from, what the terrain data covers, and says no result exists yet", () => {
    render(<SelectedSitePanel site={haworth} {...props} />);
    expect(screen.getByRole("region", { name: "Selected site" })).toBeInTheDocument();
    expect(screen.getByText("87.450° S")).toBeInTheDocument();
    expect(screen.getByText("354.800° E")).toBeInTheDocument();
    expect(screen.getByText(/Crater, 51 km across/)).toBeInTheDocument();
    expect(screen.getByText(/covers the whole 150 km footprint/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "IAU entry" })).toHaveAttribute("href", "https://planetarynames.wr.usgs.gov/x");
    expect(screen.getByText(/No run is loaded, so there is no Sun or Earth result/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter site sky" })).toBeDisabled();
  });

  it("labels demonstration points as assumptions and warns about partial coverage", () => {
    const { rerender } = render(<SelectedSitePanel site={rule} {...props} />);
    expect(screen.getByText("ASSUMPTION")).toBeInTheDocument();
    expect(screen.getByText(/not a candidate site/)).toBeInTheDocument();
    rerender(<SelectedSitePanel site={partial} {...props} />);
    expect(screen.getByText(/Partly outside the terrain data/)).toBeInTheDocument();
  });

  it("only a custom point can be removed, and the buttons call back", () => {
    const onRemove = vi.fn();
    const custom = { ...rule, id: "custom-1", kind: "custom" as const, label: "Custom point 1" };
    const { rerender } = render(<SelectedSitePanel site={haworth} {...props} />);
    expect(screen.queryByRole("button", { name: "Remove point" })).toBeNull();
    rerender(<SelectedSitePanel site={custom} {...props} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove point" }));
    fireEvent.click(screen.getByRole("button", { name: "Centre on site" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset view" }));
    expect(onRemove).toHaveBeenCalledOnce();
    expect(props.onCentre).toHaveBeenCalledOnce();
    expect(props.onReset).toHaveBeenCalledOnce();
  });

  it("Analyse this site links to the form with only this site filled in, and starts nothing", () => {
    const href = analyseHref(haworth);
    expect(href.startsWith(`/analyze?${SHARE_PARAM}=`)).toBe(true);
    const draft = decodeShare(href.split("=")[1]);
    expect(draft?.siteIds).toEqual(["iau-haworth"]);
    expect(draft?.custom).toEqual([]);
    const custom = analyseHref({ ...rule, kind: "custom", latDeg: -88.1234567, lonEastDeg: 45.5, precisionM: 1000, source: "Placed by hand in the Atlas" });
    const d2 = decodeShare(custom.split("=")[1]);
    expect(d2?.siteIds).toEqual([]);
    expect(d2?.custom[0]).toMatchObject({ lat: "-88.1235", lon: "45.5", direction: "east_positive", precision: "1000" });
  });
});

describe("SitesPanel", () => {
  const ready: Catalog = { status: "ready", sites: [rule, haworth, partial], groups: { artemis: "Artemis III features", craters: "Craters" } as never, note: null };

  it("lists every site by group, searches, and selects from the keyboard-reachable list", () => {
    const onSelect = vi.fn();
    render(<SitesPanel catalog={ready} sites={ready.sites} selectedId={null} onSelect={onSelect} onAddPoint={async () => null} customCount={0} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Artemis III features" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Haworth/ }));
    expect(onSelect).toHaveBeenCalledWith("iau-haworth");
    fireEvent.change(screen.getByLabelText("Search sites"), { target: { value: "edge" } });
    expect(screen.queryByRole("button", { name: /Haworth/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Edge/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search sites"), { target: { value: "qqq" } });
    expect(screen.getByText(/No site matches/)).toBeInTheDocument();
  });

  it("says plainly when the list could not be loaded, and shows nothing in its place", () => {
    render(<SitesPanel catalog={{ status: "error", sites: [], message: "Could not reach the web server." }} sites={[]} selectedId={null} onSelect={() => {}} onAddPoint={async () => null} customCount={0} onClose={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded.*Nothing is shown in its place/);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("adds a point by coordinates, shows the service's refusal, and caps the count", async () => {
    const onAdd = vi.fn().mockResolvedValueOnce("The terrain data covers 80° S to the pole.").mockResolvedValueOnce(null);
    const { rerender } = render(<SitesPanel catalog={ready} sites={ready.sites} selectedId={null} onSelect={() => {}} onAddPoint={onAdd} customCount={0} onClose={() => {}} />);
    const submit = screen.getByRole("button", { name: "Check coverage and add" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Latitude (°)"), { target: { value: "-70" } });
    fireEvent.change(screen.getByLabelText("East longitude (°)"), { target: { value: "10" } });
    fireEvent.click(submit);
    await waitFor(() => expect(screen.getByText(/covers 80° S to the pole/)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Latitude (°)"), { target: { value: "-88" } });
    fireEvent.click(screen.getByRole("button", { name: "Check coverage and add" }));
    await waitFor(() => expect(screen.getByText("Point added and selected.")).toBeInTheDocument());
    expect(onAdd).toHaveBeenLastCalledWith(-88, 10);
    rerender(<SitesPanel catalog={ready} sites={ready.sites} selectedId={null} onSelect={() => {}} onAddPoint={onAdd} customCount={6} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("Latitude (°)"), { target: { value: "-88" } });
    fireEvent.change(screen.getByLabelText("East longitude (°)"), { target: { value: "10" } });
    expect(screen.getByRole("button", { name: "Check coverage and add" })).toBeDisabled();
    expect(screen.getByText(/Up to 6 points/)).toBeInTheDocument();
  });
});

