import { describe, expect, it } from "vitest";
import { canUsePort } from "../src/connection";

describe("connection capabilities", () => {
  it("keeps legacy typed port direction and rejects absent ports", () => {
    expect(canUsePort({ group: "out", position: "left", dataType: "MODEL" }, "target")).toBe(false);
    expect(canUsePort({ group: "in", position: "right", dataType: "MODEL" }, "source")).toBe(false);
    expect(canUsePort(null, "source")).toBe(false);
  });
  it("separates semantic bidirectionality from IDs, groups and position", () => {
    for (const group of ["in", "out"])
      for (const terminal of ["source", "target"] as const) {
        expect(
          canUsePort(
            { id: `${group}-top`, group, position: "top", connectionDirection: "both" },
            terminal,
          ),
        ).toBe(true);
      }
  });
});
