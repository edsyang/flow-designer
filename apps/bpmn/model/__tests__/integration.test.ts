import { describe, it, expect, beforeEach, vi } from "vitest";
import { Document, contentTypesRegistry, prototypeRegistry } from "@flow-designer/model";
import type { ContentType } from "@flow-designer/model";
import { ProcessContent } from "../src/process-content";
import { ProcessRelation } from "../src/process-relation";
import {
  startEventDef,
  endEventDef,
  exclusiveGatewayDef,
  parallelGatewayDef,
  userTaskDef,
} from "@flow-designer/bpmn-nodes";

function setup() {
  if (!contentTypesRegistry.getSuitableContentType("process", "1.0.0")) {
    contentTypesRegistry.register(ProcessContent as unknown as ContentType);
  }
  if (!prototypeRegistry.getPrototypeByType("Unknown")) {
    prototypeRegistry.register({
      meta: { name: "Unknown", typeName: "Unknown" },
      schema: [],
    } as any);
  }

  const defs = [startEventDef, endEventDef, exclusiveGatewayDef, parallelGatewayDef, userTaskDef];
  for (const def of defs) {
    if (!prototypeRegistry.getPrototypeByType(def.meta.typeName)) {
      prototypeRegistry.register(def.domain);
    }
  }
}

function createDoc(elements: any[] = []) {
  return new Document({
    id: "int-test-doc",
    documentType: "process",
    documentVersion: "1.0.0",
    elements,
  });
}

describe("BPMN integration", () => {
  it("keeps incoming flows correct across parallel removal, reconnect, deletion and undo", async () => {
    setup();
    const doc = createDoc([
      { id: "a", typeName: "UserTask", props: {} },
      { id: "b", typeName: "UserTask", props: {} },
      { id: "c", typeName: "UserTask", props: {} },
    ]);
    const content = doc.getContent() as ProcessContent;
    const a = content.getNode("a")!.getRelation();
    const b = content.getNode("b")!.getRelation();
    const c = content.getNode("c")!.getRelation();
    await doc.transaction("connect", () => {
      a.addEdge({ id: "e1", targetNodeId: "b" });
      a.addEdge({ id: "e2", targetNodeId: "b" });
    });
    a.removeEdgeById("e1");
    expect(b.getFlowins()).toEqual(["a"]);
    a.updateEdge("e2", { targetNodeId: "c" });
    expect(b.getFlowins()).toEqual([]);
    expect(c.getFlowins()).toEqual(["a"]);
    await doc.transaction("delete target", () => content.removeNode("c"));
    expect(a.getEdges()).toEqual([]);
    doc.getTimeline().back();
    expect(a.getEdges()[0].targetNodeId).toBe("c");
    expect(content.getNode("c")!.getRelation().getFlowins()).toEqual(["a"]);
  });
  beforeEach(() => {
    setup();
  });

  it("creates Document with process content type", () => {
    const doc = createDoc();
    const content = doc.getContent();
    expect(content).toBeInstanceOf(ProcessContent);
  });

  it("addNode creates BPMN nodes with correct type", async () => {
    const doc = createDoc();
    const content = doc.getContent() as ProcessContent;

    const start = await content.addNode({ type: "StartEvent", props: { name: "Begin" } });
    const task = await content.addNode({
      type: "UserTask",
      props: { name: "Review", assignee: "admin" },
    });
    const end = await content.addNode({ type: "EndEvent", props: { name: "Done" } });

    expect(start).not.toBeNull();
    expect(task).not.toBeNull();
    expect(end).not.toBeNull();
    expect(content.getNodes()).toHaveLength(3);
    expect(start!.getTypeName()).toBe("StartEvent");
    expect(task!.getTypeName()).toBe("UserTask");
  });

  it("node props read/write", async () => {
    const doc = createDoc();
    const content = doc.getContent() as ProcessContent;
    const task = await content.addNode({
      type: "UserTask",
      props: { name: "Task1", assignee: "alice" },
    });

    expect(task!.getProps().getPropData("name")).toBe("Task1");
    expect(task!.getProps().getPropData("assignee")).toBe("alice");

    task!.getProps().setPropData("assignee", "bob");
    expect(task!.getProps().getPropData("assignee")).toBe("bob");
  });

  it("ProcessRelation flowin/flowout tracking with addEdge", async () => {
    const doc = createDoc();
    const content = doc.getContent() as ProcessContent;
    const start = await content.addNode({ type: "StartEvent", props: { name: "S" } });
    const task = await content.addNode({ type: "UserTask", props: { name: "T" } });
    const end = await content.addNode({ type: "EndEvent", props: { name: "E" } });

    const startRel = start!.getRelation() as ProcessRelation;
    const taskRel = task!.getRelation() as ProcessRelation;
    const endRel = end!.getRelation() as ProcessRelation;

    startRel.addEdge({ id: "e1", targetNodeId: task!.getId() });
    taskRel.addEdge({ id: "e2", targetNodeId: end!.getId() });

    expect(startRel.getFlowouts()).toHaveLength(1);
    expect(taskRel.getFlowins()).toContain(start!.getId());
    expect(taskRel.getFlowouts()).toHaveLength(1);
    expect(endRel.getFlowins()).toContain(task!.getId());
  });

  it("getData/nodesFromData round-trip preserves structure", async () => {
    const doc1 = createDoc();
    const content1 = doc1.getContent() as ProcessContent;
    const start = await content1.addNode({ type: "StartEvent", props: { name: "S" } });
    const task = await content1.addNode({ type: "UserTask", props: { name: "Review" } });
    start!.setPosition(50, 100);
    task!.setPosition(250, 100);
    (start!.getRelation() as ProcessRelation).addEdge({
      id: "e1",
      targetNodeId: task!.getId(),
      sourcePort: "out-bottom",
      targetPort: "in-top",
    });

    const data = content1.getData();
    expect(data.elements).toHaveLength(3);

    const nodeEls = data.elements!.filter((el: any) => !el.sourceRef);
    const edgeEls = data.elements!.filter((el: any) => el.sourceRef);
    expect(nodeEls).toHaveLength(2);
    expect(edgeEls).toHaveLength(1);

    const doc2 = createDoc(data.elements);
    const content2 = doc2.getContent() as ProcessContent;
    expect(content2.getNodes()).toHaveLength(2);

    const startNode = content2.getNode(start!.getId())!;
    expect(startNode.getRelation().serialize()).toHaveLength(1);
    expect(startNode.getRelation().serialize()[0].targetNodeId).toBe(task!.getId());

    const taskNode = content2.getNode(task!.getId())!;
    const taskRel = taskNode.getRelation() as ProcessRelation;
    expect(taskRel.getFlowins()).toContain(start!.getId());
  });

  it("gateway nodes register correctly", async () => {
    const doc = createDoc();
    const content = doc.getContent() as ProcessContent;
    const gw = await content.addNode({ type: "ExclusiveGateway", props: { name: "Decision" } });
    expect(gw).not.toBeNull();
    expect(gw!.getTypeName()).toBe("ExclusiveGateway");
    expect(gw!.getProps().getPropData("defaultFlow")).toBe("");
  });

  it("timeline logs prop changes", async () => {
    const doc = createDoc();
    const content = doc.getContent() as ProcessContent;
    const task = await content.addNode({ type: "UserTask", props: { name: "Original" } });
    const timeline = doc.getTimeline();

    const cursorBefore = timeline.getCurrentCursor();
    task!.getProps().setPropData("name", "Modified");
    expect(task!.getProps().getPropData("name")).toBe("Modified");
    expect(timeline.getPoints().length).toBeGreaterThanOrEqual(1);
  });

  it("undo/redo restores edge data for existing nodes", async () => {
    vi.useFakeTimers();
    const doc = createDoc();
    const content = doc.getContent() as ProcessContent;
    const timeline = doc.getTimeline();

    const startPromise = content.addNode({ type: "StartEvent", props: { name: "S" } });
    await vi.advanceTimersByTimeAsync(10);
    const start = await startPromise;
    vi.advanceTimersByTime(400);

    const taskPromise = content.addNode({ type: "UserTask", props: { name: "T" } });
    await vi.advanceTimersByTimeAsync(10);
    const task = await taskPromise;
    vi.advanceTimersByTime(400);

    expect(timeline.getCurrentCursor()).toBeGreaterThan(0);
    const cursorBeforeEdge = timeline.getCurrentCursor();

    const startRel = start!.getRelation() as ProcessRelation;
    startRel.addEdge({
      id: "e1",
      targetNodeId: task!.getId(),
      sourcePort: "out-bottom",
      targetPort: "in-top",
    });
    vi.advanceTimersByTime(400);

    const cursorAfterEdge = timeline.getCurrentCursor();
    expect(cursorAfterEdge).toBeGreaterThan(cursorBeforeEdge);
    expect(startRel.getEdges()).toHaveLength(1);

    timeline.back();
    vi.advanceTimersByTime(1);
    expect(startRel.getEdges()).toHaveLength(0);

    timeline.forward();
    vi.advanceTimersByTime(1);
    expect(startRel.getEdges()).toHaveLength(1);
    expect(startRel.getEdges()[0].id).toBe("e1");
    expect(startRel.getEdges()[0].targetNodeId).toBe(task!.getId());

    vi.useRealTimers();
  });
});
