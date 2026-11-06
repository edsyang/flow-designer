import { useLayoutEffect, useState, type RefObject } from "react";

interface HorizontalBounds {
  left: number;
  right: number;
}

/** Place only the dock; graph coordinates and viewport transforms stay untouched. */
export function toolbarCenter(
  width: number,
  dockWidth: number,
  leftPanel?: HorizontalBounds,
): number {
  const left = Math.max(0, leftPanel?.right ?? 0);
  const right = width;
  const half = Math.min(dockWidth, Math.max(0, width - 24)) / 2;
  const minimum = 12 + half;
  const maximum = width - 12 - half;
  if (maximum < minimum || right <= left) return width / 2;
  return Math.min(maximum, Math.max(minimum, (left + right) / 2));
}

export function useToolbarCenter(ref: RefObject<HTMLDivElement>): number | null {
  const [center, setCenter] = useState<number | null>(null);
  useLayoutEffect(() => {
    const dock = ref.current;
    const canvas = dock?.parentElement;
    const workspace = canvas?.parentElement;
    if (!dock || !canvas || !workspace) return;
    const reserveProperty = "--fd-canvas-dock-reserve";
    const previousReserve = workspace.style.getPropertyValue(reserveProperty);
    let ownedReserve = previousReserve;
    let frame: number | null = null;
    let disposed = false;
    const panels = () => [...workspace.querySelectorAll<HTMLElement>('[data-fd-area="sidebar"]')];
    const measure = () => {
      if (disposed) return;
      const viewport = canvas.getBoundingClientRect();
      if (!viewport.width) return;
      const bounds = (area: string): HorizontalBounds | undefined => {
        const panel = workspace.querySelector<HTMLElement>(`[data-fd-area="${area}"]`);
        if (
          !panel ||
          panel.hidden ||
          panel.querySelector(':scope > button[aria-expanded="true"]') === null
        )
          return;
        const rect = panel.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        return { left: rect.left - viewport.left, right: rect.right - viewport.left };
      };
      const dockBounds = dock.getBoundingClientRect();
      const next = toolbarCenter(viewport.width, dockBounds.width, bounds("sidebar"));
      const reserve =
        dockBounds.height > 0 ? Math.max(0, viewport.bottom - dockBounds.top) + 12 : 0;
      ownedReserve = `${String(reserve)}px`;
      workspace.style.setProperty(reserveProperty, ownedReserve);
      setCenter((previous) => (previous === next ? previous : next));
    };
    const schedule = () => {
      if (disposed || frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        measure();
      });
    };
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    const attributes = new MutationObserver(schedule);
    const observePanels = () => {
      attributes.disconnect();
      resize?.disconnect();
      resize?.observe(canvas);
      resize?.observe(dock);
      for (const panel of panels()) {
        resize?.observe(panel);
        attributes.observe(panel, {
          attributes: true,
          subtree: true,
          attributeFilter: ["class", "hidden", "aria-expanded"],
        });
      }
    };
    const children = new MutationObserver(() => {
      observePanels();
      schedule();
    });
    // Observe composition boundaries, never the graph subtree during node movement.
    children.observe(canvas, { childList: true });
    children.observe(workspace, { childList: true });
    observePanels();
    measure();
    window.addEventListener("resize", schedule);
    return () => {
      disposed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      resize?.disconnect();
      attributes.disconnect();
      children.disconnect();
      window.removeEventListener("resize", schedule);
      if (workspace.style.getPropertyValue(reserveProperty) === ownedReserve) {
        if (previousReserve) workspace.style.setProperty(reserveProperty, previousReserve);
        else workspace.style.removeProperty(reserveProperty);
      }
    };
  }, [ref]);
  return center;
}
