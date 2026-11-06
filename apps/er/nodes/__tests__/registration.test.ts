import { describe, expect, it } from "vitest";
import { createRegistrySet } from "@flow-designer/model";
import { UiContributionRegistry } from "../../../../packages/skeleton/src/ui-contributions";
const domain = createRegistrySet();
const prototypeRegistry = domain.prototypes;
const registry = { prototypes: prototypeRegistry, ui: new UiContributionRegistry() };
import { setLocale, t } from "@flow-designer/i18n";
import { ER_TYPE_NAMES } from "../src/constants";
import { refreshERTranslations, registerERNodes } from "../src";

const NODE_TYPES = Object.values(ER_TYPE_NAMES);

function registeredTypes(): string[] {
  return prototypeRegistry.getRegistry().map((prototype) => prototype.getTypeName());
}

// This suite owns its domain and UI registrations.
describe("ER node registration", () => {
  it("a translation refresh does not register nodes", () => {
    refreshERTranslations(registry);

    expect(registeredTypes()).toHaveLength(0);
  });

  it("registerERNodes registers every ER node type", () => {
    registerERNodes(registry);

    expect(registeredTypes().sort()).toEqual([...NODE_TYPES].sort());
    for (const typeName of NODE_TYPES) {
      expect(prototypeRegistry.getPrototypeByType(typeName)).not.toBeNull();
    }
  });

  it("is idempotent and does not duplicate registry entries", () => {
    registerERNodes(registry);
    registerERNodes(registry);

    expect(registeredTypes()).toHaveLength(NODE_TYPES.length);
  });

  it("updates already-registered prototypes when the locale changes", async () => {
    registerERNodes(registry);
    await setLocale("en-US");
    refreshERTranslations(registry);
    expect(prototypeRegistry.getPrototypeByType(ER_TYPE_NAMES.TABLE)?.getName()).toBe(
      t("er.node.table"),
    );

    await setLocale("zh-CN");
    refreshERTranslations(registry);
    expect(prototypeRegistry.getPrototypeByType(ER_TYPE_NAMES.TABLE)?.getName()).toBe(
      t("er.node.table"),
    );
  });
});
