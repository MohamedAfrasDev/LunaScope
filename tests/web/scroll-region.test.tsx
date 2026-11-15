import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScrollRegion } from "@/components/ui/scroll-region";

afterEach(() => vi.restoreAllMocks());

function size(scrollWidth: number, clientWidth: number) {
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(scrollWidth);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(clientWidth);
}

describe("ScrollRegion", () => {
  it("adds no tab stop and no landmark when everything fits", () => {
    size(300, 300);
    render(<ScrollRegion label="Wide table"><table><tbody><tr><td>x</td></tr></tbody></table></ScrollRegion>);
    expect(screen.queryByRole("region")).toBeNull();
    expect(document.querySelector("[tabindex]")).toBeNull();
  });

  it("becomes a named, keyboard-reachable region when it overflows", () => {
    size(900, 300);
    render(<ScrollRegion label="Wide table"><table><tbody><tr><td>x</td></tr></tbody></table></ScrollRegion>);
    const r = screen.getByRole("region", { name: "Wide table" });
    expect(r).toHaveAttribute("tabindex", "0");
    expect(r.className).toContain("overflow-x-auto");
  });
});
