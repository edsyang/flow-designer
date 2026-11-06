import { describe, it, expect } from "vitest";
import { graphMessages } from "../src/messages";
describe("graph locale messages", () => {
  it("keeps route diagnostics in the selected language", () => {
    expect(graphMessages["zh-CN"]["workbench.connection.routeUnavailable"]).toContain("无法");
    expect(graphMessages["zh-CN"]["workbench.connection.legacyRouteWarning"]).toContain("已有连线");
    expect(graphMessages["en-US"]["workbench.connection.routeUnavailable"]).toContain("No route");
    expect(graphMessages["en-US"]["workbench.connection.legacyRouteWarning"]).toContain(
      "Some existing",
    );
  });
});
