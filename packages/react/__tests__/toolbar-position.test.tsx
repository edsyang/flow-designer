import { useRef } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toolbarCenter, useToolbarCenter } from "../src/panels/toolbar-position";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("floating dock placement", () => {
  it("centres after the expanded sidebar, returns to canvas centre, and clamps narrow canvases", () => {
    expect(toolbarCenter(1440, 400, { left: 12, right: 236 })).toBe(838);
    expect(toolbarCenter(1440, 400)).toBe(720);
    expect(toolbarCenter(543, 408, { left: 8, right: 188 })).toBe(327);
    expect(toolbarCenter(543, 408)).toBe(271.5);
    expect(toolbarCenter(300, 408, { left: 8, right: 188 })).toBe(150);
  });

  it("ignores inspector changes, tracks sidebar visibility and actual dock clearance, then releases observers", async () => {
    let resizeCallback = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resizeCallback = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    let width = 1440;
    let dockTop = 800;
    let dockHeight = 50;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.dataset.fdArea === "sidebar") return new DOMRect(12, 12, 224, 800);
      if (this.dataset.fdArea === "inspector") return new DOMRect(width - 308, 12, 296, 400);
      if (this.dataset.fdArea === "canvasToolbar") return new DOMRect(0, dockTop, 400, dockHeight);
      return new DOMRect(0, 0, width, 900);
    });
    function Dock() {
      const ref = useRef<HTMLDivElement>(null);
      const center = useToolbarCenter(ref);
      return (
        <div
          ref={ref}
          data-fd-area="canvasToolbar"
          data-testid="dock"
          style={{ left: center ?? undefined }}
        />
      );
    }
    const { container, unmount } = render(
      <div data-fd-area="workbench">
        <div data-testid="workspace">
          <div data-fd-area="sidebar">
            <button aria-expanded="true" />
          </div>
          <div data-testid="canvas">
            <div data-fd-area="inspector">
              <button aria-expanded="true" />
            </div>
            <Dock />
          </div>
        </div>
      </div>,
    );
    const workspace = screen.getByTestId("workspace");
    expect(screen.getByTestId("dock").style.left).toBe("838px");
    expect(workspace.style.getPropertyValue("--fd-canvas-dock-reserve")).toBe("112px");
    act(() => {
      container.querySelector('[data-fd-area="inspector"]')!.setAttribute("hidden", "");
      resizeCallback();
    });
    await waitFor(() => expect(screen.getByTestId("dock").style.left).toBe("838px"));
    const sidebar = container.querySelector<HTMLElement>('[data-fd-area="sidebar"]')!;
    act(() => {
      sidebar.hidden = true;
    });
    await waitFor(() => expect(screen.getByTestId("dock").style.left).toBe("720px"));
    act(() => {
      sidebar.hidden = false;
    });
    await waitFor(() => expect(screen.getByTestId("dock").style.left).toBe("838px"));
    act(() => {
      sidebar.querySelector("button")!.setAttribute("aria-expanded", "false");
    });
    await waitFor(() => expect(screen.getByTestId("dock").style.left).toBe("720px"));
    act(() => {
      width = 800;
      dockTop = 740;
      dockHeight = 100;
      resizeCallback();
    });
    await waitFor(() => expect(screen.getByTestId("dock").style.left).toBe("400px"));
    expect(workspace.style.getPropertyValue("--fd-canvas-dock-reserve")).toBe("172px");
    expect(screen.getByTestId("canvas").getAttribute("style")).toBeNull();
    unmount();
    expect(disconnect).toHaveBeenCalled();
    expect(workspace.style.getPropertyValue("--fd-canvas-dock-reserve")).toBe("");
  });
});
