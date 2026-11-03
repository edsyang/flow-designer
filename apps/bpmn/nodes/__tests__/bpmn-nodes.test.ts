import { describe, it, expect } from "vitest";
import { prototypeRegistry, setLocale } from "@flow-designer/model";
import { refreshBpmnTranslations, registerBpmnNodes } from "../src";
import { startEventDef } from "../src/start-event";
import { endEventDef } from "../src/end-event";
import { exclusiveGatewayDef } from "../src/exclusive-gateway";
import { parallelGatewayDef } from "../src/parallel-gateway";
import { inclusiveGatewayDef } from "../src/inclusive-gateway";
import { eventBasedGatewayDef } from "../src/event-based-gateway";
import { userTaskDef } from "../src/user-task";
import { processGlobalDef } from "../src/process-global";
import { isValidBpmnConnection } from "../src/sequence-flow";
import { BPMN_TYPE_NAMES } from "../src/constants";

const allDefs = [
  startEventDef,
  endEventDef,
  exclusiveGatewayDef,
  parallelGatewayDef,
  inclusiveGatewayDef,
  eventBasedGatewayDef,
  userTaskDef,
  processGlobalDef,
];

const EXPECTED_NAMES: Record<string, string> = {
  StartEvent: "开始",
  EndEvent: "结束",
  ExclusiveGateway: "排他网关",
  ParallelGateway: "并行网关",
  InclusiveGateway: "包容网关",
  EventBasedGateway: "事件网关",
  UserTask: "人工节点",
  ProcessGlobal: "流程属性",
};

describe("BPMN node definitions", () => {
  it("all 8 definitions have required fields", () => {
    for (const def of allDefs) {
      expect(def.meta).toBeDefined();
      expect(def.meta.name).toBeTruthy();
      expect(def.meta.typeName).toBeTruthy();
      expect(def.meta.category).toBeTruthy();
      expect(def.view).toBeDefined();
      expect(def.view.type).toBe("node");
      expect(def.schema).toBeDefined();
      expect(def.editor).toBeDefined();
    }
  });

  it("StartEvent has correct shape and ports", () => {
    expect(startEventDef.meta.typeName).toBe(BPMN_TYPE_NAMES.START_EVENT);
    expect(startEventDef.view.quickAdd).toBe(false);
    expect(startEventDef.view.shape).toBe("fd-circle");
    expect(startEventDef.view.defaultSize).toEqual({ width: 50, height: 50 });
    expect(startEventDef.view.ports).toHaveLength(4);
    expect(startEventDef.view.ports!.every((p) => p.group === "out")).toBe(true);
  });

  it("EndEvent has correct shape and ports", () => {
    expect(endEventDef.meta.typeName).toBe(BPMN_TYPE_NAMES.END_EVENT);
    expect(endEventDef.view.quickAdd).toBe(false);
    expect(endEventDef.view.shape).toBe("fd-circle-end");
    expect(endEventDef.view.ports).toHaveLength(4);
    expect(endEventDef.view.ports!.every((p) => p.group === "in")).toBe(true);
  });

  it("only allows sequence flows from outgoing to incoming ports", () => {
    expect(
      isValidBpmnConnection({
        sourceNode: "start",
        sourcePort: startEventDef.view.ports![0],
        targetNode: "task",
        targetPort: userTaskDef.view.ports![0],
      }),
    ).toBe(true);
    expect(
      isValidBpmnConnection({
        sourceNode: "task",
        sourcePort: userTaskDef.view.ports![2],
        targetNode: "start",
        targetPort: startEventDef.view.ports![0],
      }),
    ).toBe(false);
    expect(
      isValidBpmnConnection({
        sourceNode: "end",
        sourcePort: endEventDef.view.ports![0],
        targetNode: "task",
        targetPort: userTaskDef.view.ports![0],
      }),
    ).toBe(false);
    expect(
      isValidBpmnConnection({
        sourceNode: "task",
        sourcePort: userTaskDef.view.ports![2],
        targetNode: "end",
        targetPort: endEventDef.view.ports![0],
      }),
    ).toBe(true);
  });

  it("ExclusiveGateway has diamond shape with 4 ports", () => {
    expect(exclusiveGatewayDef.meta.typeName).toBe(BPMN_TYPE_NAMES.EXCLUSIVE_GATEWAY);
    expect(exclusiveGatewayDef.view.shape).toBe("fd-diamond");
    expect(exclusiveGatewayDef.view.ports).toHaveLength(4);
    const groups = exclusiveGatewayDef.view.ports!.map((p) => p.group);
    expect(groups.filter((g) => g === "in")).toHaveLength(2);
    expect(groups.filter((g) => g === "out")).toHaveLength(2);
    expect(exclusiveGatewayDef.schema.find((s) => s.name === "defaultFlow")).toBeDefined();
  });

  it("ParallelGateway has diamond shape with 4 ports", () => {
    expect(parallelGatewayDef.meta.typeName).toBe(BPMN_TYPE_NAMES.PARALLEL_GATEWAY);
    expect(parallelGatewayDef.view.shape).toBe("fd-diamond");
    expect(parallelGatewayDef.view.ports).toHaveLength(4);
  });

  it("InclusiveGateway has diamond shape with 4 ports and defaultFlow", () => {
    expect(inclusiveGatewayDef.meta.typeName).toBe(BPMN_TYPE_NAMES.INCLUSIVE_GATEWAY);
    expect(inclusiveGatewayDef.view.shape).toBe("fd-diamond");
    expect(inclusiveGatewayDef.view.defaultSize).toEqual({ width: 90, height: 58 });
    expect(inclusiveGatewayDef.view.ports).toHaveLength(4);
    const groups = inclusiveGatewayDef.view.ports!.map((p) => p.group);
    expect(groups.filter((g) => g === "in")).toHaveLength(2);
    expect(groups.filter((g) => g === "out")).toHaveLength(2);
    expect(inclusiveGatewayDef.schema.find((s) => s.name === "defaultFlow")).toBeDefined();
  });

  it("EventBasedGateway has diamond shape with 4 ports and instantiate", () => {
    expect(eventBasedGatewayDef.meta.typeName).toBe(BPMN_TYPE_NAMES.EVENT_BASED_GATEWAY);
    expect(eventBasedGatewayDef.view.shape).toBe("fd-diamond");
    expect(eventBasedGatewayDef.view.defaultSize).toEqual({ width: 90, height: 58 });
    expect(eventBasedGatewayDef.view.ports).toHaveLength(4);
    expect(eventBasedGatewayDef.schema.find((s) => s.name === "instantiate")).toBeDefined();
  });

  it("UserTask has rect shape with all expected props", () => {
    expect(userTaskDef.meta.typeName).toBe(BPMN_TYPE_NAMES.USER_TASK);
    expect(userTaskDef.view.shape).toBe("fd-rect");
    expect(userTaskDef.view.defaultSize).toEqual({ width: 120, height: 40 });
    expect(userTaskDef.view.ports).toHaveLength(4);
    const schemaNames = userTaskDef.schema.map((s) => s.name);
    expect(schemaNames).toContain("name");
    expect(schemaNames).toContain("assignee");
    expect(schemaNames).toContain("description");
  });

  it("all type names are unique", () => {
    const typeNames = allDefs.map((d) => d.meta.typeName);
    expect(new Set(typeNames).size).toBe(typeNames.length);
  });

  it("all definitions have Chinese display names", () => {
    for (const def of allDefs) {
      expect(EXPECTED_NAMES[def.meta.typeName]).toBe(def.meta.name);
    }
  });

  it("ProcessGlobal is not draggable and has process-level schema", () => {
    expect(processGlobalDef.meta.typeName).toBe(BPMN_TYPE_NAMES.PROCESS_GLOBAL);
    expect(processGlobalDef.meta.category).toBe("global");
    expect(processGlobalDef.view.draggable).toBe(false);
    expect(processGlobalDef.view.deletable).toBe(false);
    expect(processGlobalDef.view.shape).toBeUndefined();
    const schemaNames = processGlobalDef.schema.map((s) => s.name);
    expect(schemaNames).toContain("processName");
    expect(schemaNames).toContain("processId");
    expect(schemaNames).toContain("description");
    expect(schemaNames).toContain("isExecutable");
    expect(processGlobalDef.editor).toHaveLength(4);
  });

  it("refreshes registered labels and settings when the locale changes", async () => {
    registerBpmnNodes();
    await setLocale("en-US");
    const changedDefaults = refreshBpmnTranslations();

    expect(startEventDef.meta.name).toBe("Start");
    expect(startEventDef.meta.categoryTitle).toBe("Events");
    expect(startEventDef.editor[0]?.description).toBe("Name");
    expect(prototypeRegistry.getPrototypeByType("StartEvent")?.getName()).toBe("Start");
    expect(changedDefaults).toContainEqual({
      typeName: "StartEvent",
      previous: "开始",
      next: "Start",
    });

    await setLocale("zh-CN");
    refreshBpmnTranslations();
  });
});
