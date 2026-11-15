import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalyzeForm } from "@/components/AnalyzeForm";
import { decodeShare, encodeShare, emptyCustom, referenceDraft, type Draft } from "@/lib/draft";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const json = (x: unknown) => new Response(JSON.stringify(x), { headers: { "content-type": "application/json" } });
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

const b64 = (o: unknown) => btoa(JSON.stringify(o)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");

describe("share link encoding", () => {
  const draft: Draft = {
    ...referenceDraft(["rule-89.5S-E0", "rule-89.5S-E120"]), radiusKm: "120", sensitivity: true,
    custom: [{ ...emptyCustom(), lat: "-85", lon: "45", direction: "west_positive", source: "Schröder & co., table 2 ✓", precision: "30" }],
  };

  it("round-trips every input, including non-ASCII source notes", () => {
    expect(decodeShare(encodeShare(draft))).toEqual(draft);
  });

  it("carries the form inputs and nothing else", () => {
    const decoded = JSON.parse(atob(encodeShare(draft).replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (encodeShare(draft).length % 4)) % 4)));
    expect(Object.keys(decoded).sort()).toEqual(["custom", "demProfile", "durationDays", "earthMinPct", "azStepDeg", "mastM", "radiusKm", "sensitivity", "siteIds", "startDate", "startTime", "stepMin", "sunMinPct", "v"].sort());
    expect(JSON.stringify(decoded)).not.toMatch(/token|run_id|result_id|authorization/i);
  });

  const good = { v: 1, ...referenceDraft(["rule-89.5S-E0"]) };
  it.each<[string, string | null]>([
    ["nothing", null],
    ["not base64url", "a b!c"],
    ["too long", "A".repeat(3001)],
    ["not JSON", btoa("hello").replace(/=+$/, "")],
    ["wrong version", b64({ ...good, v: 2 })],
    ["a number where text is expected", b64({ ...good, radiusKm: 150 })],
    ["an unknown DEM profile", b64({ ...good, demProfile: "../../etc/passwd" })],
    ["a path as a site id", b64({ ...good, siteIds: ["../x"] })],
    ["too many sites", b64({ ...good, siteIds: Array.from({ length: 7 }, (_, i) => `s${i}`) })],
    ["a custom point with a bad direction", b64({ ...good, custom: [{ ...emptyCustom(), direction: "up" }] })],
    ["an over-long source note", b64({ ...good, custom: [{ ...emptyCustom(), source: "x".repeat(201) }] })],
    ["a missing field", b64({ v: 1 })],
  ])("rejects %s", (_name, raw) => expect(decodeShare(raw)).toBeNull());

  it("ignores extra fields instead of passing them along", () => {
    const d = decodeShare(b64({ ...good, evil: "<script>", __proto__: { polluted: true } }));
    expect(d).not.toBeNull();
    expect(Object.keys(d as object)).not.toContain("evil");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

const sites = {
  note: "Rule-chosen demonstration points.",
  sites: ["rule-89.5S-E0", "rule-89.5S-E120"].map((id) => ({
    site_id: id, label: id, lat_deg: -89.5, lon_east_deg: 0, convention: "planetocentric", source: "rule", precision_m: 100,
    kind: "demonstration_rule", dem_coverage_150km: { covered_fraction: 1, fully_covered: true, sectors_with_gap: 0, radius_km: 150 },
  })),
};

describe("opening a shared link", () => {
  it("fills the form, says nothing was run, removes the parameter, and sends no run request", async () => {
    const posts: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
      if (init?.method === "POST") posts.push(String(u));
      return json(sites);
    }));
    const shared: Draft = { ...referenceDraft(["rule-89.5S-E120"]), radiusKm: "90", sensitivity: true };
    window.history.replaceState(null, "", `/analyze?d=${encodeShare(shared)}`);
    render(<AnalyzeForm />);
    expect(await screen.findByText(/These inputs came from a shared link. Nothing has been run/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Horizon radius/)).toHaveValue("90");
    expect(window.location.search).toBe("");
    expect(within(screen.getByRole("group", { name: /Sites/ })).getByLabelText(/120/)).toBeChecked();
    expect(posts).toEqual([]);
  });

  it("ignores an unreadable link and shows the defaults, saying so", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(sites)));
    window.history.replaceState(null, "", "/analyze?d=garbage!!");
    render(<AnalyzeForm />);
    expect(await screen.findByText(/That link could not be read, so the default inputs are shown/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Horizon radius/)).toHaveValue("150");
  });

  it("drops preset sites that are not in the catalog rather than sending an unknown id", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(sites)));
    window.history.replaceState(null, "", `/analyze?d=${encodeShare(referenceDraft(["rule-89.5S-E0", "not-a-site"]))}`);
    render(<AnalyzeForm />);
    await screen.findByText(/shared link/);
    expect(screen.getByRole("group", { name: /Sites/ }).querySelectorAll("input[type=checkbox]:checked")).toHaveLength(1);
  });
});
