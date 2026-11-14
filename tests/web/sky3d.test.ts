import { describe, expect, it } from "vitest";
import {
  azElFromDir,
  clampFov,
  clampPitch,
  describeScene,
  dirFromAzEl,
  elevationRing,
  skylineRuns,
  skylineWall,
  trackRuns,
} from "@/lib/sky3d";
import type { IntervalRow, SkySeries } from "@/lib/api/types";

const close = (a: number, b: number, d = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(d);

describe("3D sky coordinates", () => {
  it("puts north on -z, east on +x, south on +z and the zenith on +y", () => {
    const n = dirFromAzEl(0, 0);
    const e = dirFromAzEl(90, 0);
    const s = dirFromAzEl(180, 0);
    const up = dirFromAzEl(0, 90);
    [n[2] < -0.999, e[0] > 0.999, s[2] > 0.999, up[1] > 0.999].forEach((x) => expect(x).toBe(true));
  });

  it("is not mirrored: azimuth runs clockwise seen from above (north to east to south)", () => {
    // seen from above (+y looking down), clockwise N -> E -> S: x goes from 0 to +, then z goes from - to +
    const a = dirFromAzEl(45, 0);
    expect(a[0]).toBeGreaterThan(0);
    expect(a[2]).toBeLessThan(0); // north-east is north of the origin line: -z
    const b = dirFromAzEl(135, 0);
    expect(b[0]).toBeGreaterThan(0);
    expect(b[2]).toBeGreaterThan(0); // south-east
  });

  it("round-trips azimuth and elevation, and keeps the radius", () => {
    for (const [az, el] of [[0, 0], [37, 4.2], [200, -3], [359.5, 25]] as const) {
      const v = dirFromAzEl(az, el, 10);
      close(Math.hypot(...v), 10);
      const r = azElFromDir(v);
      close(r.az, az, 1e-9 + (az === 359.5 ? 1e-9 : 0));
      close(r.el, el, 1e-9);
    }
  });
});

describe("skyline wall", () => {
  const az = Array.from({ length: 8 }, (_, i) => i * 45);

  it("makes one strip per known bin pair and rises exactly to the service's skyline elevation", () => {
    const el = [1, 2, 3, 4, 5, 6, 7, 8];
    const m = skylineWall(az, el, 10, -10);
    expect(m.indices.length).toBe(8 * 6);
    // the top vertex of the first strip is the skyline at azimuth 0: elevation 1 degree
    const top = [m.positions[3], m.positions[4], m.positions[5]] as [number, number, number];
    const r = azElFromDir(top);
    close(r.el, 1, 1e-4);
    close(r.az, 0, 1e-4);
  });

  it("leaves an unknown bin OPEN: no strip touches it, so it is never drawn as flat ground", () => {
    const el: (number | null)[] = [1, 2, null, 4, 5, 6, 7, 8];
    const m = skylineWall(az, el, 10, -10);
    expect(m.indices.length).toBe((8 - 2) * 6); // bins 1-2 and 2-3 both touch the unknown bin
    // every vertex elevation is either the floor or a known skyline value; none equals a made-up zero for the gap
    const els: number[] = [];
    for (let i = 0; i < m.positions.length; i += 3) els.push(azElFromDir([m.positions[i], m.positions[i + 1], m.positions[i + 2]]).el);
    expect(els.some((e) => Math.abs(e) < 1e-6)).toBe(false);
  });

  it("applies vertical exaggeration to elevation angles only", () => {
    const m1 = skylineWall(az, [2, 2, 2, 2, 2, 2, 2, 2], 10, -10, 1);
    const m3 = skylineWall(az, [2, 2, 2, 2, 2, 2, 2, 2], 10, -10, 3);
    const e1 = azElFromDir([m1.positions[3], m1.positions[4], m1.positions[5]]).el;
    const e3 = azElFromDir([m3.positions[3], m3.positions[4], m3.positions[5]]).el;
    close(e1, 2, 1e-4);
    close(e3, 6, 1e-4);
  });

  it("ridge lines break at unknown bins and close into a loop when every bin is known", () => {
    expect(skylineRuns(az, [1, 2, null, 4, 5, 6, 7, 8], 10).length).toBe(2);
    const loop = skylineRuns(az, [1, 1, 1, 1, 1, 1, 1, 1], 10);
    expect(loop.length).toBe(1);
    expect(loop[0].length).toBe((8 + 1) * 3);
  });

  it("elevation rings are circles of constant elevation", () => {
    const ring = elevationRing(5, 10, 36);
    for (let i = 0; i < ring.length; i += 3) close(azElFromDir([ring[i], ring[i + 1], ring[i + 2]]).el, 5, 1e-4);
  });
});

describe("track runs", () => {
  const series: SkySeries = { step_s: 600, az_deg: [10, 12, 14, 16, 18, 20], el_deg: [1, 1.1, 1.2, 1.3, 1.4, 1.5] };
  const iv = (class_: string, a: number, b: number): IntervalRow =>
    ({ class: class_, start_s: a, end_s: b, start_utc: "", end_utc: "" }) as unknown as IntervalRow;

  it("splits the path where the service's class changes, sharing the boundary sample", () => {
    const runs = trackRuns(series, [iv("H", 0, 1200), iv("V", 1200, 3000)], 10);
    expect(runs.map((r) => r.cls)).toEqual(["H", "V"]);
    expect(runs[0].positions.length).toBe(3 * 3); // samples 0,1,2
    expect(runs[1].positions.length).toBe(4 * 3); // samples 2,3,4,5
    expect(Array.from(runs[0].positions.slice(-3))).toEqual(Array.from(runs[1].positions.slice(0, 3)));
  });

  it("gives one run for a single class and none for an empty series", () => {
    expect(trackRuns(series, [iv("H", 0, 3000)], 10).length).toBe(1);
    expect(trackRuns({ step_s: 600, az_deg: [], el_deg: [] }, [], 10)).toEqual([]);
  });
});

describe("camera limits and words", () => {
  it("clamps pitch short of the poles and the field of view to a usable range", () => {
    expect(clampPitch(120)).toBe(89);
    expect(clampPitch(-120)).toBe(-89);
    expect(clampFov(5)).toBe(25);
    expect(clampFov(170)).toBe(100);
  });

  it("states the state in words and the exaggeration when it is not 1", () => {
    const t = describeScene({
      site: "Haworth", clock: "2027-01-10 00:00:00 UTC", exaggeration: 3,
      targets: [{ label: "Sun", az: 153.48, el: 0.42, cls: "H" }, { label: "Earth", az: 356.82, el: -0.75, cls: "U" }],
    });
    expect(t).toContain("Sun at azimuth 153 degrees, elevation 0.4 degrees, hidden by terrain or below the horizon");
    expect(t).toContain("unresolved (inside the numerical decision band)");
    expect(t).toContain("exaggerated 3 times");
    expect(describeScene({ site: "x", clock: "c", exaggeration: 1, targets: [] })).not.toContain("exaggerated");
  });
});
