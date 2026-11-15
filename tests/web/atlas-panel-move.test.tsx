import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Panel } from "@/components/atlas/Panel";

/** jsdom has no layout: give the panel a box so the clamping has something to work with. */
function box(el: HTMLElement, r: { left: number; top: number; width: number; height: number }) {
  el.getBoundingClientRect = () => ({ ...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top, toJSON: () => ({}) }) as DOMRect;
}
const ptr = (type: string, target: EventTarget, x: number, y: number) =>
  act(() => void target.dispatchEvent(Object.assign(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }), { pointerId: 1 })));

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", { value: 1200, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
});
afterEach(() => Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true }));

describe("Panel move and resize", () => {
  function setup() {
    render(
      <Panel title="Metrics" onClose={() => {}}>
        <p>body</p>
      </Panel>,
    );
    const panel = screen.getByRole("region", { name: "Metrics" });
    box(panel, { left: 100, top: 100, width: 300, height: 400 });
    return { panel, handle: screen.getByTestId("panel-handle"), grip: screen.getByTestId("panel-resize") };
  }

  it("moves by its title bar and goes back on a double-click", () => {
    const { panel, handle } = setup();
    ptr("pointerdown", handle, 150, 110);
    ptr("pointermove", handle, 250, 160);
    ptr("pointerup", handle, 250, 160);
    expect(panel.style.transform).toBe("translate(100px, 50px)");
    fireEvent.doubleClick(handle);
    expect(panel.style.transform).toBe("");
  });

  it("never leaves the screen: a strip of the title bar stays reachable", () => {
    const { panel, handle } = setup();
    ptr("pointerdown", handle, 150, 110);
    ptr("pointermove", handle, 5000, 5000);
    ptr("pointerup", handle, 5000, 5000);
    // right edge: left 100 + dx <= 1200 - 80  =>  dx <= 1020; bottom: top 100 + dy <= 800 - 40  =>  dy <= 660
    expect(panel.style.transform).toBe("translate(1020px, 660px)");
    box(panel, { left: 1120, top: 760, width: 300, height: 400 }); // where the browser now reports it
    ptr("pointerdown", handle, 150, 110);
    ptr("pointermove", handle, -9000, -9000);
    ptr("pointerup", handle, -9000, -9000);
    expect(panel.style.transform).toBe("translate(-320px, -100px)"); // back to the far top-left corner, with 80 px of the title bar still on screen
  });

  it("does not start a drag from a button in the title bar", () => {
    const { panel } = setup();
    const close = screen.getByRole("button", { name: "Close Metrics" });
    ptr("pointerdown", close, 150, 110);
    ptr("pointermove", close, 300, 300);
    expect(panel.style.transform).toBe("");
  });

  it("resizes from its corner, within a minimum and the screen", () => {
    const { panel, grip } = setup();
    ptr("pointerdown", grip, 400, 500);
    ptr("pointermove", grip, 500, 560);
    expect(panel.style.width).toBe("400px");
    expect(panel.style.height).toBe("460px");
    ptr("pointermove", grip, -5000, -5000);
    expect(panel.style.width).toBe("240px");
    expect(panel.style.height).toBe("120px");
    ptr("pointermove", grip, 9000, 9000);
    expect(panel.style.width).toBe("1092px"); // 1200 - left 100 - 8
    ptr("pointerup", grip, 9000, 9000);
  });

  it("stays where it is on a phone", () => {
    Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
    const { panel, handle, grip } = setup();
    ptr("pointerdown", handle, 150, 110);
    ptr("pointermove", handle, 250, 160);
    ptr("pointerdown", grip, 400, 500);
    ptr("pointermove", grip, 500, 560);
    expect(panel.style.transform).toBe("");
    expect(panel.style.width).toBe("");
  });

  it("collapsing hides the corner grip", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Collapse Metrics" }));
    expect(screen.queryByTestId("panel-resize")).toBeNull();
  });
});
