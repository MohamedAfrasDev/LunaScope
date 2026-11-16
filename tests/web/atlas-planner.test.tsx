import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlannerPanel } from "@/components/atlas/PlannerPanel";
import type { AtlasSite } from "@/lib/atlas/sites";

const site = (id: string, label: string, lat: number): AtlasSite => ({
  id, label, latDeg: lat, lonEastDeg: 10, kind: "named", group: "g", featureType: null, diameterKm: null, source: "s", iauUrl: null, precisionM: 20, coverage: null,
});

const base = {
  sites: [site("a", "Shackleton rim", -89.9), site("b", "Malapert massif", -85.9)],
  selectedId: null as string | null,
  onSelect: vi.fn(),
  runWindow: null,
  runLabel: null,
  tracks: null,
  loadNote: null,
  canCompute: true,
  startedRunId: null,
  loadedRunId: null,
  onStarted: vi.fn(),
};

describe("PlannerPanel", () => {
  it("lists sites, filters them, and picks one", () => {
    render(<PlannerPanel {...base} />);
    expect(screen.getByText("Where do you want to land?")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Find a site"), { target: { value: "malap" } });
    expect(screen.queryByText("Shackleton rim")).toBeNull();
    fireEvent.click(screen.getByText("Malapert massif"));
    expect(base.onSelect).toHaveBeenCalledWith("b");
  });

  it("says what is missing when the run does not hold the site, and explains an offline copy", () => {
    render(<PlannerPanel {...base} selectedId="a" canCompute={false} />);
    fireEvent.click(screen.getByRole("tab", { name: /2 When/ }));
    // offline: the button reads the answer from the loaded run instead of computing a new one
    expect(screen.queryByRole("button", { name: "See the answer" })).toBeNull();
    expect(screen.getByRole("button", { name: "See the answer in the loaded run" })).toBeEnabled();
    expect(screen.getByText(/cannot compute a new date or window/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /3 Answer/ }));
    expect(screen.getByText(/does not hold this site/)).toBeInTheDocument();
  });
});
