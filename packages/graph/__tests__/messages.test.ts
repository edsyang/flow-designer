import { describe, it, expect } from "vitest";
import { createI18n } from "@flow-designer/i18n";
describe("graph locale messages", () => {
  it("keeps route diagnostics in the selected language", async () => {
    const service = createI18n();
    await service.initializeI18n();
    expect(service.t("workbench.connection.routeUnavailable")).toContain("无法");
    expect(service.t("workbench.connection.legacyRouteWarning")).toContain("已有连线");
    await service.setLocale("en-US");
    expect(service.t("workbench.connection.routeUnavailable")).toContain("No route");
    expect(service.t("workbench.connection.legacyRouteWarning")).toContain("Some existing");
  });
});
