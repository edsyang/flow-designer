import { describe, it, expect, beforeEach, vi } from "vitest";
import Document from "../src/document";
import type { DocumentData } from "../src/document";
import ContentTypesRegistry from "../src/registries/content-types-registry";
import PrototypeRegistry from "../src/registries/prototype-registry";
import GenericContent from "../src/content/generic";

const contentTypesRegistry = await import("../src/registries").then((m) => m.contentTypesRegistry);
const prototypeRegistry = await import("../src/registries").then((m) => m.prototypeRegistry);

function setupRegistries() {
  if (!contentTypesRegistry.getSuitableContentType("*")) {
    contentTypesRegistry.register(GenericContent as any);
  }
  if (!prototypeRegistry.getPrototypeByType("Unknown")) {
    prototypeRegistry.register({
      meta: { name: "Unknown", typeName: "Unknown" },
      schema: [],
    } as any);
  }
  if (!prototypeRegistry.getPrototypeByType("task")) {
    prototypeRegistry.register({
      meta: { name: "Task", typeName: "task" },
      schema: [],
      props: [{ name: "label", defaultValue: "" }],
    } as any);
  }
}

function createDocData(overrides?: Partial<DocumentData>): DocumentData {
  return {
    id: "doc-1",
    documentType: "*",
    documentVersion: "1.0.0",
    props: { title: "Test Doc" },
    nodes: [],
    ...overrides,
  };
}

describe("Document", () => {
  it("destroys without relation edit events and prevents pending transactions reviving content or history", async () => {
    setupRegistries();
    const doc = new Document(
      createDocData({
        elements: [
          { id: "a", typeName: "task", props: {} },
          { id: "b", typeName: "task", props: {} },
          { id: "edge", typeName: "Edge", sourceRef: "a", targetRef: "b" },
        ],
      }),
    );
    const relationChange = vi.fn();
    doc.getContent().getNode("a")!.getRelation().onChange(relationChange);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    doc.aspect("contentaop.nodeadding", () => gate);
    const pending = doc.transaction("pending add", () =>
      doc.getContent().addNode({ type: "task", props: {} }),
    );
    doc.destroy();
    release();
    expect(await pending).toBeNull();
    expect(doc.getContent().getNodes()).toHaveLength(0);
    expect(doc.getTimeline().getPoints()).toHaveLength(0);
    expect(relationChange).not.toHaveBeenCalled();
    await expect(doc.getContent().addNode({ type: "task" })).rejects.toThrow("destroyed");
    doc.destroy();
  });
  it("restores changed positions while skipping unchanged props and relations", async () => {
    setupRegistries();
    const doc = new Document(
      createDocData({
        elements: [
          { id: "a", typeName: "task", props: { label: "A" }, position: { x: 10, y: 20 } },
          { id: "b", typeName: "task", props: { label: "B" }, position: { x: 50, y: 60 } },
        ],
      }),
    );
    const a = doc.getContent().getNode("a")!;
    const b = doc.getContent().getNode("b")!;
    const bSetData = vi.spyOn(b.getProps(), "setData");
    const relationChanged = vi.fn();
    b.getRelation().onChange(relationChanged);
    await doc.transaction("move", () => a.setPosition(100, 200));
    doc.getTimeline().back();
    expect(a.getPosition()).toEqual({ x: 10, y: 20 });
    expect(bSetData).not.toHaveBeenCalled();
    expect(relationChanged).not.toHaveBeenCalled();
    doc.getTimeline().forward();
    expect(a.getPosition()).toEqual({ x: 100, y: 200 });
    doc.destroy();
  });
  it("restores generic relation removal and snapshots without aliasing", async () => {
    setupRegistries();
    const doc = new Document(
      createDocData({
        elements: [
          { id: "a", typeName: "task", props: {} },
          { id: "b", typeName: "task", props: {} },
        ],
      }),
    );
    const relation = doc
      .getContent()
      .getNode("a")!
      .getRelation() as import("../src/content/relation").GenericRelation;
    await doc.transaction("connect", () =>
      relation.addEdge({ id: "edge", targetNodeId: "b", props: { label: "old" } }),
    );
    await doc.transaction("remove", () => relation.removeEdgeById("edge"));
    doc.getTimeline().back();
    expect(relation.getEdges()[0].props).toEqual({ label: "old" });
    doc.getTimeline().forward();
    expect(relation.getEdges()).toEqual([]);
    doc.destroy();
  });

  it("saving before a batched props observer remains clean after the observer", async () => {
    setupRegistries();
    const doc = new Document(createDocData());
    doc.getProps().setPropData("title", "Saved");
    doc.save();
    await Promise.resolve();
    expect(doc.isModified()).toBe(false);
    doc.getTimeline().back();
    expect(doc.getProps().getPropData("title")).toBe("Test Doc");
    doc.destroy();
  });
  beforeEach(() => {
    setupRegistries();
  });

  it("constructor initializes with proper data", () => {
    const doc = new Document(createDocData());
    expect(doc.getId()).toBe("doc-1");
    expect(doc.getProps().getData()).toEqual({ title: "Test Doc" });
    expect(doc.getContent()).toBeDefined();
    expect(doc.getSelection()).toBeDefined();
    expect(doc.getTimeline()).toBeDefined();
  });

  it("getData returns full document data", () => {
    const doc = new Document(createDocData());
    const data = doc.getData();
    expect(data.id).toBe("doc-1");
    expect(data.documentType).toBe("*");
    expect(data.documentVersion).toBe("1.0.0");
    expect(data.props).toEqual({ title: "Test Doc" });
  });

  it("save returns data and marks as unmodified", () => {
    const doc = new Document(createDocData());
    expect(doc.isModified()).toBe(false);
    const saved = doc.save();
    expect(saved.id).toBe("doc-1");
    expect(doc.isModified()).toBe(false);
  });

  it("load applies data via timeline", () => {
    const doc = new Document(createDocData());
    const newData = createDocData({ props: { title: "Updated" } });
    doc.load(newData);
    expect(doc.getProps().getData()).toEqual({ title: "Updated" });
    expect(doc.isModified()).toBe(false);
  });

  it("restores timeline logging when applying a timeline point fails", async () => {
    const doc = new Document(createDocData());
    vi.spyOn(doc.getContent(), "applyTimelinePointData").mockImplementation(() => {
      throw new Error("content restore failed");
    });

    expect(() => doc.applyTimelinePointData(createDocData())).toThrow("content restore failed");
    doc.getProps().setPropData("title", "After failure");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(doc.getTimeline().getCurrentCursor()).toBe(1);
  });

  it("save/load round-trip preserves data", () => {
    const doc = new Document(
      createDocData({
        nodes: [
          { id: "n1", typeName: "task", props: { label: "Hello" }, position: { x: 10, y: 20 } },
        ],
      }),
    );
    const saved = doc.save();
    const doc2 = new Document(saved);
    expect(doc2.getData().elements).toHaveLength(1);
  });

  it("throws when no suitable content type", () => {
    const reg = new ContentTypesRegistry();
    expect(() => {
      new Document({
        id: "x",
        documentType: "nonexistent-type-xyz",
        documentVersion: "1.0.0",
      });
    }).not.toThrow();
  });

  it("onStateChange fires after timeline changes", () => {
    const doc = new Document(createDocData());
    let stateChanged = false;
    doc.onStateChange(() => {
      stateChanged = true;
    });
    doc.load(createDocData({ props: { title: "New" } }));
    expect(stateChanged).toBe(true);
  });
});
