import { describe, expect, it } from "vitest";
import { prototypeRegistry } from "@flow-designer/model";
import { setLocale, t } from "@flow-designer/i18n";
import { ER_TYPE_NAMES } from "../src/constants";
import { refreshERTranslations, registerERNodes } from "../src";

const NODE_TYPES = Object.values(ER_TYPE_NAMES);

function registeredTypes(): string[] {
  return prototypeRegistry.getRegistry().map((prototype) => prototype.getTypeName());
}

// The registry is a process-wide singleton and this file runs in its own module
// graph, so these tests can assert the "not registered yet" state directly.
describe("ER node registration", () => {
  it("a translation refresh does not register nodes", () => {
    refreshERTranslations();

    expect(registeredTypes()).toHaveLength(0);
  });

  it("registerERNodes registers every ER node type", () => {
    registerERNodes();

    expect(registeredTypes().sort()).toEqual([...NODE_TYPES].sort());
    for (const typeName of NODE_TYPES) {
      expect(prototypeRegistry.getPrototypeByType(typeName)).not.toBeNull();
    }
  });

  it("is idempotent and does not duplicate registry entries", () => {
    registerERNodes();
    registerERNodes();

    expect(registeredTypes()).toHaveLength(NODE_TYPES.length);
  });

  it("updates already-registered prototypes when the locale changes", async () => {
    registerERNodes();
    await setLocale("en-US");
    refreshERTranslations();
    expect(prototypeRegistry.getPrototypeByType(ER_TYPE_NAMES.TABLE)?.getName()).toBe(
      t("er.node.table"),
    );

    await setLocale("zh-CN");
    refreshERTranslations();
    expect(prototypeRegistry.getPrototypeByType(ER_TYPE_NAMES.TABLE)?.getName()).toBe(
      t("er.node.table"),
    );
  });
});
