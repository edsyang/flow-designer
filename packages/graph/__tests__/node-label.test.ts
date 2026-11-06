import { describe, expect, it } from "vitest";
import { truncateNodeLabel } from "../src/node-label";
describe("adapter-owned visual labels", () => {
  it("keeps existing rectangle, diamond and circle width rules without modifying business data", () => {
    const name = "abcdefghijklmnop";
    expect(truncateNodeLabel(name)).toBe("abcdefghijk…");
    expect(truncateNodeLabel(name, "fd-diamond")).toBe("abcdefghi…");
    expect(truncateNodeLabel(name, "fd-circle")).toBe("abcdefg…");
    expect(truncateNodeLabel("开始事件名称", "fd-circle")).toBe("开…");
    expect(name).toBe("abcdefghijklmnop");
  });
});
