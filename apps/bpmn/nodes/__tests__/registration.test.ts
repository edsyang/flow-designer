import { describe, expect, it } from "vitest";
import { prototypeRegistry } from "@flow-designer/model";
import { setLocale } from "@flow-designer/i18n";
import { BPMN_TYPE_NAMES } from "../src/constants";
import { refreshBpmnTranslations, registerBpmnNodes } from "../src";

const NODE_TYPES = Object.entries(BPMN_TYPE_NAMES)
  .filter(([, typeName]) => typeName !== BPMN_TYPE_NAMES.SEQUENCE_FLOW)
  .map(([, typeName]) => typeName);

function registeredTypes(): string[] {
  return prototypeRegistry.getRegistry().map((prototype) => prototype.getTypeName());
}

// The registry is a process-wide singleton and this file runs in its own module
// graph, so these tests can assert the "not registered yet" state directly.
describe("BPMN node registration", () => {
  it("a translation refresh does not register nodes", () => {
    refreshBpmnTranslations();

    expect(registeredTypes()).toHaveLength(0);
  });

  it("registerBpmnNodes registers every BPMN node type", () => {
    registerBpmnNodes();

    expect(registeredTypes().sort()).toEqual([...NODE_TYPES].sort());
    for (const typeName of NODE_TYPES) {
      expect(prototypeRegistry.getPrototypeByType(typeName)).not.toBeNull();
    }
  });

  it("is idempotent and does not duplicate registry entries", () => {
    registerBpmnNodes();
    registerBpmnNodes();

    expect(registeredTypes()).toHaveLength(NODE_TYPES.length);
  });

  it("updates already-registered prototypes when the locale changes", async () => {
    registerBpmnNodes();
    await setLocale("en-US");
    refreshBpmnTranslations();
    expect(prototypeRegistry.getPrototypeByType(BPMN_TYPE_NAMES.START_EVENT)?.getName()).toBe(
      "Start",
    );

    await setLocale("zh-CN");
    refreshBpmnTranslations();
    expect(prototypeRegistry.getPrototypeByType(BPMN_TYPE_NAMES.START_EVENT)?.getName()).toBe(
      "开始",
    );
  });
});
