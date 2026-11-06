import { describe, it, expect, vi } from "vitest";
import Timeline from "../src/document/timeline";

function createTimeline(initialData: any = { v: 0 }) {
  let state = { ...initialData };
  const logger = vi.fn(() => ({ ...state }));
  const applier = vi.fn((data: any) => {
    state = data;
  });
  const tl = new Timeline(logger, applier);
  return {
    tl,
    logger,
    applier,
    getState: () => state,
    setState: (s: any) => {
      state = s;
    },
  };
}

describe("Timeline", () => {
  it("keeps no-op nested failures clean and preserves redo checkpoints", async () => {
    const { tl, setState, getState } = createTimeline();
    await tl.transaction("real", () => {
      setState({ v: 1 });
      tl.log("edit");
    });
    tl.back();
    await new Promise((resolve) => setTimeout(resolve, 1));
    const points = [...tl.getPoints()];
    await expect(
      tl.transaction("failed creation", async () => {
        setState({ v: 2 });
        tl.log("temporary");
        await tl.transaction("nested compensation", () => {
          setState({ v: 0 });
          tl.log("compensate");
        });
        throw new Error("rejected");
      }),
    ).rejects.toThrow("rejected");
    expect(tl.getPoints()).toEqual(points);
    expect(tl.getCurrentCursor()).toBe(0);
    expect(tl.isModified()).toBe(false);
    tl.forward();
    expect(getState()).toEqual({ v: 1 });
  });

  it("preserves the effective starting state when an operation returns to an older checkpoint", async () => {
    const { tl, setState, getState } = createTimeline();
    setState({ v: 1 });
    await tl.transaction("restore old value", () => {
      setState({ v: 0 });
      tl.log("edit");
    });
    expect(tl.getPoints()).toHaveLength(3);
    tl.back();
    expect(getState()).toEqual({ v: 1 });
  });

  it("records pre-existing unlogged changes before a net-zero transaction and reconciles saves", async () => {
    const { tl, setState, getState } = createTimeline();
    setState({ v: 1 });
    await tl.transaction("no-op", () => {
      setState({ v: 2 });
      tl.log("temporary");
      setState({ v: 1 });
      tl.log("compensate");
      tl.savePoint();
    });
    expect(tl.getPoints()).toHaveLength(2);
    expect(tl.isModified()).toBe(false);
    tl.back();
    expect(getState()).toEqual({ v: 0 });
  });

  it("handles save inside a transaction and a delayed observer after save", async () => {
    const { tl, setState } = createTimeline();
    await tl.transaction("edit and save", () => {
      setState({ v: 1 });
      tl.log("edit");
      tl.savePoint();
    });
    expect(tl.isModified()).toBe(false);
    tl.log("delayed observer");
    expect(tl.isModified()).toBe(false);
    await tl.transaction("save then edit", () => {
      setState({ v: 2 });
      tl.log("edit");
      tl.savePoint();
      setState({ v: 3 });
      tl.log("later edit");
    });
    expect(tl.isModified()).toBe(true);
  });
  it("commits nested asynchronous edits once and preserves rejected partial work for undo", async () => {
    const { tl, setState, getState } = createTimeline();
    await expect(
      tl.transaction("outer", async () => {
        setState({ v: 1 });
        tl.log("one");
        await tl.transaction("inner", async () => {
          await Promise.resolve();
          setState({ v: 2 });
          tl.log("two");
        });
        throw new Error("rejected");
      }),
    ).rejects.toThrow("rejected");
    expect(tl.getPoints()).toHaveLength(2);
    expect(tl.getPoints()[1].getTitle()).toBe("outer");
    tl.back();
    expect(getState()).toEqual({ v: 0 });
  });

  it("separates saves from live coalescing and distinguishes a replacement branch", async () => {
    const { tl, setState } = createTimeline();
    await tl.transaction("one", () => {
      setState({ v: 1 });
      tl.log("one");
    });
    tl.savePoint();
    setState({ v: 2 });
    tl.log("two");
    expect(tl.isModified()).toBe(true);
    tl.back();
    expect(tl.isModified()).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 1));
    tl.back();
    await new Promise((resolve) => setTimeout(resolve, 1));
    await tl.transaction("branch", () => {
      setState({ v: 3 });
      tl.log("branch");
    });
    expect(tl.getCurrentCursor()).toBe(1);
    expect(tl.isModified()).toBe(true);
  });

  it("bounds checkpoints and replaces loaded history with a clean baseline", async () => {
    const { tl, setState, getState } = createTimeline();
    for (let v = 1; v <= 120; v++) {
      await tl.transaction("edit", () => {
        setState({ v });
        tl.log("edit");
      });
    }
    expect(tl.getPoints()).toHaveLength(100);
    expect(tl.getCurrentCursor()).toBe(99);
    tl.apply({ v: 999 });
    expect(tl.getPoints()).toHaveLength(1);
    expect(tl.isModified()).toBe(false);
    tl.back();
    expect(getState()).toEqual({ v: 999 });
  });
  it("initial state: cursor 0, not modified, one point", () => {
    const { tl } = createTimeline();
    expect(tl.getCurrentCursor()).toBe(0);
    expect(tl.isModified()).toBe(false);
    expect(tl.getPoints()).toHaveLength(1);
  });

  it("log creates new points after alive timeout", () => {
    const { tl } = createTimeline();
    vi.useFakeTimers();
    tl.log("change1");
    expect(tl.getCurrentCursor()).toBe(1);
    vi.advanceTimersByTime(400);
    tl.log("change2");
    expect(tl.getCurrentCursor()).toBe(2);
    expect(tl.getPoints()).toHaveLength(3);
    vi.useRealTimers();
  });

  it("back/forward navigate history", () => {
    const { tl, setState } = createTimeline({ v: "init" });
    vi.useFakeTimers();

    setState({ v: "step1" });
    tl.log("step1");
    expect(tl.getCurrentCursor()).toBe(1);
    vi.advanceTimersByTime(400);

    setState({ v: "step2" });
    tl.log("step2");
    expect(tl.getCurrentCursor()).toBe(2);
    vi.advanceTimersByTime(400);

    setState({ v: "step3" });
    tl.log("step3");
    expect(tl.getCurrentCursor()).toBe(3);
    vi.advanceTimersByTime(400);

    tl.back();
    expect(tl.getCurrentCursor()).toBe(2);

    tl.back();
    expect(tl.getCurrentCursor()).toBe(1);

    tl.back();
    expect(tl.getCurrentCursor()).toBe(0);

    tl.back();
    expect(tl.getCurrentCursor()).toBe(0);

    tl.forward();
    expect(tl.getCurrentCursor()).toBe(1);

    vi.useRealTimers();
  });

  it("does not advance or emit navigation when applying a timeline point fails", () => {
    const { tl, setState, applier } = createTimeline();
    vi.useFakeTimers();
    setState({ v: 1 });
    tl.log("change");
    const cursorHandler = vi.fn();
    tl.onCursor(cursorHandler);
    applier.mockImplementation(() => {
      throw new Error("restore failed");
    });

    expect(() => tl.back()).toThrow("restore failed");
    expect(tl.getCurrentCursor()).toBe(1);
    expect(cursorHandler).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("go clamps to valid range", () => {
    const { tl } = createTimeline();
    tl.go(-10);
    expect(tl.getCurrentCursor()).toBe(0);
    tl.go(999);
    expect(tl.getCurrentCursor()).toBe(0);
  });

  it("pause suppresses log", () => {
    const { tl, logger } = createTimeline();
    vi.useFakeTimers();
    tl.pause();
    logger.mockClear();
    tl.log("ignored");
    expect(logger).not.toHaveBeenCalled();
    tl.resume();
    tl.log("captured");
    expect(logger).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("nested pause/resume is counter-based", () => {
    const { tl, logger } = createTimeline();
    tl.pause();
    tl.pause();
    tl.resume();
    logger.mockClear();
    tl.log("still paused");
    expect(logger).not.toHaveBeenCalled();
    tl.resume();
    tl.log("now active");
    expect(logger).toHaveBeenCalled();
  });

  it("resume below 0 is clamped", () => {
    const { tl } = createTimeline();
    tl.resume();
    tl.resume();
    expect(() => tl.log("ok")).not.toThrow();
  });

  it("setApplier replaces the applier function", () => {
    const { tl, applier } = createTimeline();
    const newApplier = vi.fn();
    tl.setApplier(newApplier);
    vi.useFakeTimers();
    tl.log("x");
    vi.advanceTimersByTime(400);
    tl.back();
    expect(newApplier).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("apply calls applier with pause/resume and savePoint", () => {
    const { tl, applier } = createTimeline();
    tl.apply({ v: "loaded" });
    expect(applier).toHaveBeenCalledWith({ v: "loaded" });
    expect(tl.isModified()).toBe(false);
  });

  it("savePoint marks current cursor as unmodified", () => {
    const { tl, setState } = createTimeline();
    vi.useFakeTimers();
    setState({ v: 1 });
    tl.log("edit");
    expect(tl.getCurrentCursor()).toBe(1);
    expect(tl.isModified()).toBe(true);
    tl.savePoint();
    expect(tl.isModified()).toBe(false);
    vi.useRealTimers();
  });

  it("onStateChange fires on log and go", () => {
    const { tl, setState } = createTimeline();
    const fn = vi.fn();
    tl.onStateChange(fn);
    vi.useFakeTimers();
    setState({ v: 1 });
    tl.log("edit");
    expect(fn).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("destroy cleans up", () => {
    const { tl } = createTimeline();
    const fn = vi.fn();
    tl.onStateChange(fn);
    tl.destroy();
    expect(tl.getPoints()).toHaveLength(0);
  });

  it("log works after go once deferred navigating flag clears", () => {
    const { tl, setState } = createTimeline({ v: "init" });
    vi.useFakeTimers();

    setState({ v: "step1" });
    tl.log("step1");
    vi.advanceTimersByTime(400);

    setState({ v: "step2" });
    tl.log("step2");
    vi.advanceTimersByTime(400);
    expect(tl.getCurrentCursor()).toBe(2);

    tl.back();
    expect(tl.getCurrentCursor()).toBe(1);

    // go() sets navigating=true and defers clearing via setTimeout(0).
    // Advance timers to flush the macrotask.
    vi.advanceTimersByTime(1);

    setState({ v: "new-after-undo" });
    tl.log("new");
    expect(tl.getCurrentCursor()).toBe(2);
    expect(tl.getPoints()).toHaveLength(3);

    vi.useRealTimers();
  });
});
