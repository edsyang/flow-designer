import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZoomControl } from "../src/zoom/zoom-control";

afterEach(cleanup);

describe("zoom control", () => {
  it("sends slider scale, follows graph scale changes and disposes its subscription", () => {
    let zoom = 1;
    let notify = () => {};
    const dispose = vi.fn();
    const onZoomTo = vi.fn((factor: number) => {
      zoom = factor;
    });
    const { unmount } = render(
      <ZoomControl
        getZoom={() => zoom}
        onZoomTo={onZoomTo}
        onZoomIn={() => {
          zoom += 0.1;
        }}
        onZoomOut={() => {
          zoom -= 0.1;
        }}
        onResetZoom={() => {
          zoom = 0.4;
        }}
        subscribe={(callback) => {
          notify = callback;
          return dispose;
        }}
      />,
    );
    const slider = screen.getByRole("slider", { name: "缩放比例" });
    fireEvent.change(slider, { target: { value: "150" } });
    expect(onZoomTo).toHaveBeenCalledWith(1.5);
    expect(slider.getAttribute("aria-valuetext")).toBe("150%");
    act(() => {
      zoom = 0.75;
      notify();
    });
    expect((slider as HTMLInputElement).value).toBe("75");
    fireEvent.click(screen.getByRole("button", { name: "放大" }));
    expect(slider.getAttribute("aria-valuetext")).toBe("85%");
    fireEvent.click(screen.getByRole("button", { name: "适应画布" }));
    expect(slider.getAttribute("aria-valuetext")).toBe("40%");
    unmount();
    expect(dispose).toHaveBeenCalledOnce();
  });
});
