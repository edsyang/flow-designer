import { describe, expect, it } from "vitest";
import { createRegistrySet } from "@flow-designer/model";
import { UiContributionRegistry } from "../../../../packages/skeleton/src/ui-contributions";
const domain = createRegistrySet();
const prototypeRegistry = domain.prototypes;
const registry = { prototypes: prototypeRegistry, ui: new UiContributionRegistry() };
import { setLocale } from "@flow-designer/i18n";
import { BPMN_TYPE_NAMES } from "../src/constants";
import { refreshBpmnTranslations, registerBpmnNodes } from "../src";

const NODE_TYPES = Object.entries(BPMN_TYPE_NAMES)
  .filter(([, typeName]) => typeName !== BPMN_TYPE_NAMES.SEQUENCE_FLOW)
  .map(([, typeName]) => typeName);

function registeredTypes(): string[] {
  return prototypeRegistry.getRegistry().map((prototype) => prototype.getTypeName());
}

// This suite owns its domain and UI registrations.
describe("BPMN node registration", () => {
  it("a translation refresh does not register nodes", () => {
    refreshBpmnTranslations(registry);

    expect(registeredTypes()).toHaveLength(0);
  });

  it("registerBpmnNodes registers every BPMN node type", () => {
    registerBpmnNodes(registry);

    expect(registeredTypes().sort()).toEqual([...NODE_TYPES].sort());
    for (const typeName of NODE_TYPES) {
      expect(prototypeRegistry.getPrototypeByType(typeName)).not.toBeNull();
    }
  });

  it("is idempotent and does not duplicate registry entries", () => {
    registerBpmnNodes(registry);
    registerBpmnNodes(registry);

    expect(registeredTypes()).toHaveLength(NODE_TYPES.length);
  });

  it("updates already-registered prototypes when the locale changes", async () => {
    registerBpmnNodes(registry);
    await setLocale("en-US");
    refreshBpmnTranslations(registry);
    expect(prototypeRegistry.getPrototypeByType(BPMN_TYPE_NAMES.START_EVENT)?.getName()).toBe(
      "Start",
    );

    await setLocale("zh-CN");
    refreshBpmnTranslations(registry);
    expect(prototypeRegistry.getPrototypeByType(BPMN_TYPE_NAMES.START_EVENT)?.getName()).toBe(
      "开始",
    );
  });
});
