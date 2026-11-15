import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AmbientToggle } from "@/components/AmbientToggle";

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.motion;
});

describe("AmbientToggle", () => {
  it("pauses and resumes the background motion and remembers the choice", () => {
    render(<AmbientToggle />);
    const b = screen.getByRole("button", { name: "Pause background motion" });
    expect(b).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(b);
    expect(document.documentElement.dataset.motion).toBe("paused");
    expect(localStorage.getItem("lunascope.motion")).toBe("paused");
    fireEvent.click(screen.getByRole("button", { name: "Resume background motion" }));
    expect(document.documentElement.dataset.motion).toBeUndefined();
    expect(localStorage.getItem("lunascope.motion")).toBeNull();
  });

  it("restores a remembered pause on load", () => {
    localStorage.setItem("lunascope.motion", "paused");
    render(<AmbientToggle />);
    expect(screen.getByRole("button", { name: "Resume background motion" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.dataset.motion).toBe("paused");
  });
});
