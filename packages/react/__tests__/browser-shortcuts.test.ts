import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserShortcuts } from "../src/browser/shortcuts";
afterEach(() => document.body.replaceChildren());
function press(target: HTMLElement) {
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Delete", keyCode: 46, bubbles: true, cancelable: true }),
  );
}
function owner() {
  const root = document.createElement("div");
  root.dataset.fdArea = "workbench";
  root.tabIndex = 0;
  document.body.append(root);
  return root;
}
describe("editor browser shortcuts", () => {
  it("isolates equal shortcuts by focused owner, including nested workbenches and disposal", () => {
    const first = owner(),
      second = owner();
    first.append(second);
    const a = createBrowserShortcuts(() => first),
      b = createBrowserShortcuts(() => second);
    const onA = vi.fn(),
      onB = vi.fn();
    a.bind("del", onA);
    b.bind("del", onB);
    press(first);
    expect(onA).toHaveBeenCalledTimes(1);
    expect(onB).not.toHaveBeenCalled();
    press(second);
    expect(onA).toHaveBeenCalledTimes(1);
    expect(onB).toHaveBeenCalledTimes(1);
    a.dispose();
    press(second);
    expect(onB).toHaveBeenCalledTimes(2);
    b.dispose();
    press(second);
    expect(onB).toHaveBeenCalledTimes(2);
    expect(() => a.bind("del", onA)).toThrow("disposal");
  });
  it("uses registration identities for overlapping combinations and out-of-order cleanup", () => {
    const root = owner(),
      shortcuts = createBrowserShortcuts(() => root);
    const first = vi.fn(),
      second = vi.fn();
    const releaseFirst = shortcuts.bind(["del", "backspace"], first);
    const releaseSecond = shortcuts.bind("del", second);
    press(root);
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
    releaseFirst();
    releaseFirst();
    press(root);
    expect(second).toHaveBeenCalledTimes(2);
    releaseSecond();
    press(root);
    expect(second).toHaveBeenCalledTimes(2);
    const releaseBase = shortcuts.bind("del", first);
    const releaseOverlay = shortcuts.bind("del", second);
    releaseOverlay();
    press(root);
    expect(first).toHaveBeenCalledOnce();
    releaseBase();
    shortcuts.dispose();
  });
});
