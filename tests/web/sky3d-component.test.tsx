import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sky3D } from "@/components/Sky3D";
import type { HorizonProfileResponse, IntervalRow, SkySeries } from "@/lib/api/types";

const profile = {
  site_id: "iau-haworth", result_state: "real_data_unverified",
  azimuth_deg: [0, 90, 180, 270], horizon_el_deg: [3, 4, 5, null],
} as unknown as HorizonProfileResponse;
const series: SkySeries = { step_s: 600, az_deg: [100, 101, 102], el_deg: [0.4, 0.5, 0.6] };
const intervals = [{ class: "H", start_s: 0, end_s: 1200, start_utc: "", end_utc: "" }] as unknown as IntervalRow[];
const tracks = [{ target: "sun_center", series, intervals }] as never;

describe("3D sky view without WebGL", () => {
  it("says so in words and points to the other views (jsdom has no WebGL)", async () => {
    render(<Sky3D profile={profile} tracks={tracks} t={0} siteName="Haworth" clock="2027-01-10 00:00:00 UTC" />);
    expect(await screen.findByRole("status")).toHaveTextContent(/needs WebGL/);
    expect(screen.getByRole("status")).toHaveTextContent(/polar and unrolled views show the same sky/);
  });
});
