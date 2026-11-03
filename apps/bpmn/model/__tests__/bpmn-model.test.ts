import { describe, it, expect, beforeEach } from "vitest";
import { Document, contentTypesRegistry, prototypeRegistry } from "@flow-designer/model";
import type { ContentType } from "@flow-designer/model";
import { ProcessContent } from "../src/process-content";
import { ProcessRelation } from "../src/process-relation";

function setup() {
  if (!contentTypesRegistry.getSuitableContentType("process", "1.0.0")) {
    contentTypesRegistry.register(ProcessContent as unknown as ContentType);
  }
  if (!prototypeRegistry.getPrototypeByType("Unknown")) {
    prototypeRegistry.register({
      name: "Unknown",
      typeName: "Unknown",
      view: { type: "node", pulled: false, shape: () => null },
    } as any);
  }
  if (!prototypeRegistry.getPrototypeByType("UserTask")) {
    prototypeRegistry.register({
      name: "UserTask",
      typeName: "UserTask",
      view: { type: "node", pulled: false, shape: () => null },
      props: [
        { name: "name", defaultValue: "" },
        { name: "assignee", defaultValue: "" },
      ],
    } as any);
  }
  if (!prototypeRegistry.getPrototypeByType("StartEvent")) {
    prototypeRegistry.register({
      name: "StartEvent",
      typeName: "StartEvent",
      view: { type: "node", pulled: false, shape: () => null },
      props: [{ name: "name", defaultValue: "Start" }],
    } as any);
  }
  if (!prototypeRegistry.getPrototypeByType("EndEvent")) {
    prototypeRegistry.register({
      name: "EndEvent",
      typeName: "EndEvent",
      view: { type: "node", pulled: false, shape: () => null },
      props: [{ name: "name", defaultValue: "End" }],
    } as any);
  }
}

function createDoc(elements: any[] = []) {
  return new Document({
    id: "test-doc",
    documentType: "process",
    documentVersion: "1.0.0",
    elements,
  });
}

describe("ProcessContent", () => {
  beforeEach(() => {
    setup();
  });

  it("parses elements via nodesFromData", () => {
    const doc = createDoc([
      { id: "n1", typeName: "StartEvent", props: { name: "Start" }, position: { x: 0, y: 0 } },
      { id: "n2", typeName: "UserTask", props: { name: "Review" }, position: { x: 200, y: 0 } },
    ]);
    const content = doc.getContent() as ProcessContent;
    expect(content.getNodes()).toHaveLength(2);
    expect(content.getNode("n1")).not.toBeNull();
    expect(content.getNode("n2")).not.toBeNull();
  });

  it("getData returns elements format without relations in nodes", () => {
    const doc = createDoc([
      { id: "n1", typeName: "UserTask", props: { name: "Task A" }, position: { x: 10, y: 20 } },
    ]);
    const content = doc.getContent() as ProcessContent;
    const data = content.getData();
    expect(data.elements).toHaveLength(1);
    expect(data.elements![0].typeName).toBe("UserTask");
    expect(data.elements![0].id).toBe("n1");
    expect(data.elements![0]).not.toHaveProperty("relations");
  });

  it("round-trips getData/nodesFromData with edges as top-level elements", () => {
    const initial = [
      { id: "n1", typeName: "StartEvent", props: { name: "S" }, position: { x: 0, y: 0 } },
      { id: "n2", typeName: "EndEvent", props: { name: "E" }, position: { x: 200, y: 0 } },
      { id: "e1", typeName: "SequenceFlow", sourceRef: "n1", targetRef: "n2" },
    ];
    const doc1 = createDoc(initial);
    const data = (doc1.getContent() as ProcessContent).getData();

    const doc2 = createDoc(data.elements);
    const content2 = doc2.getContent() as ProcessContent;
    expect(content2.getNodes()).toHaveLength(2);
    const n1 = content2.getNode("n1")!;
    expect(n1.getRelation().serialize()).toHaveLength(1);
    expect(n1.getRelation().serialize()[0].targetNodeId).toBe("n2");
  });

  it("addNode creates a new node", async () => {
    const doc = createDoc();
    const content = doc.getContent() as ProcessContent;
    const node = await content.addNode({ type: "UserTask", props: { name: "New Task" } });
    expect(node).not.toBeNull();
    expect(content.getNodes()).toHaveLength(1);
  });

  it("getSerialId generates unique IDs", () => {
    const doc = createDoc();
    const content = doc.getContent() as ProcessContent;
    const id1 = content.getSerialId("task");
    const id2 = content.getSerialId("task");
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^task-/);
  });
});

describe("ProcessRelation", () => {
  beforeEach(() => {
    setup();
  });

  it("creates ProcessRelation instances for nodes", () => {
    const doc = createDoc([
      { id: "n1", typeName: "UserTask", props: {}, position: { x: 0, y: 0 } },
    ]);
    const content = doc.getContent() as ProcessContent;
    const relation = content.getNode("n1")!.getRelation();
    expect(relation).toBeInstanceOf(ProcessRelation);
  });

  it("edge tracking: addEdge populates source flowouts and target flowins", () => {
    const doc = createDoc([
      { id: "n1", typeName: "StartEvent", props: {}, position: { x: 0, y: 0 } },
      { id: "n2", typeName: "EndEvent", props: {}, position: { x: 200, y: 0 } },
    ]);
    const content = doc.getContent() as ProcessContent;
    const r1 = content.getNode("n1")!.getRelation() as ProcessRelation;
    const r2 = content.getNode("n2")!.getRelation() as ProcessRelation;

    r1.addEdge({ id: "e1", targetNodeId: "n2" });

    expect(r1.getFlowouts()).toHaveLength(1);
    expect(r1.getFlowouts()[0].targetNodeId).toBe("n2");
    expect(r2.getFlowins()).toContain("n1");
  });

  it("removeEdge cleans up target flowins", () => {
    const doc = createDoc([
      { id: "n1", typeName: "StartEvent", props: {}, position: { x: 0, y: 0 } },
      { id: "n2", typeName: "EndEvent", props: {}, position: { x: 200, y: 0 } },
    ]);
    const content = doc.getContent() as ProcessContent;
    const r1 = content.getNode("n1")!.getRelation() as ProcessRelation;
    const r2 = content.getNode("n2")!.getRelation() as ProcessRelation;

    r1.addEdge({ id: "e1", targetNodeId: "n2" });
    r1.removeEdge("n2");

    expect(r1.getFlowouts()).toHaveLength(0);
    expect(r2.getFlowins()).toHaveLength(0);
  });

  it("didInit rebuilds flowins from persisted edges", () => {
    const doc = createDoc([
      { id: "n1", typeName: "StartEvent", props: {}, position: { x: 0, y: 0 } },
      { id: "n2", typeName: "EndEvent", props: {}, position: { x: 200, y: 0 } },
      { id: "e1", typeName: "SequenceFlow", sourceRef: "n1", targetRef: "n2" },
    ]);
    const content = doc.getContent() as ProcessContent;
    const r2 = content.getNode("n2")!.getRelation() as ProcessRelation;
    expect(r2.getFlowins()).toContain("n1");
  });

  it("defaultFlowout management", () => {
    const doc = createDoc([
      { id: "n1", typeName: "StartEvent", props: {}, position: { x: 0, y: 0 } },
      { id: "n2", typeName: "EndEvent", props: {}, position: { x: 200, y: 0 } },
    ]);
    const content = doc.getContent() as ProcessContent;
    const r1 = content.getNode("n1")!.getRelation() as ProcessRelation;

    r1.addEdge({ id: "e1", targetNodeId: "n2" });
    r1.setDefaultFlowout("e1");
    expect(r1.getDefaultFlowout()).toBe("e1");

    r1.setDefaultFlowout(null);
    expect(r1.getDefaultFlowout()).toBeNull();
  });

  it("serialize returns edges", () => {
    const doc = createDoc([
      { id: "n1", typeName: "StartEvent", props: {}, position: { x: 0, y: 0 } },
      { id: "n2", typeName: "EndEvent", props: {}, position: { x: 200, y: 0 } },
      {
        id: "e1",
        typeName: "SequenceFlow",
        sourceRef: "n1",
        targetRef: "n2",
        sourcePort: "out-bottom",
        targetPort: "in-top",
      },
    ]);
    const content = doc.getContent() as ProcessContent;
    const edges = content.getNode("n1")!.getRelation().serialize();
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      id: "e1",
      targetNodeId: "n2",
      sourcePort: "out-bottom",
      targetPort: "in-top",
    });
  });
});
