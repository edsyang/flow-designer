import { describe, expect, it, vi } from "vitest";
import Document, { DocumentCollection } from "../src/document";
import GenericContent from "../src/content/generic";
import { RegistrySet } from "../src/registries/registry-set";
import type { NodeDefinition } from "../src/prototype";
function definition(name: string): NodeDefinition {
  return {
    meta: { name, typeName: "same" },
    connection: { ports: [{ id: name, group: "out", position: "right" }] },
    schema: [{ name: "name", type: "string", defaultValue: name }],
  };
}
function registries() {
  const set = new RegistrySet();
  set.contentTypes.register(GenericContent);
  return set;
}
function doc(set: RegistrySet) {
  return new Document({ id: "same-doc", documentType: "*", documentVersion: "1.0.0" }, [], {
    registries: set,
  });
}
describe("document registry and signal ownership", () => {
  it("forks independent prototypes/definitions while retaining callbacks", async () => {
    const seed = registries();
    const original = definition("Seed");
    const initialized = vi.fn();
    original.lifecycle = { nodeDidInit: initialized };
    seed.prototypes.register(original);
    const a = seed.fork(),
      b = seed.fork();
    original.meta.name = "External mutation";
    a.prototypes.register(definition("A"));
    expect(b.prototypes.getPrototypeByType("same")?.getName()).toBe("Seed");
    expect(seed.prototypes.getPrototypeByType("same")?.getName()).toBe("Seed");
    const first = doc(a),
      second = doc(b);
    try {
      const nodeA = await first.getContent().addNode({ type: "same" });
      const nodeB = await second.getContent().addNode({ type: "same" });
      expect(nodeA?.getProps().getPropData("name")).toBe("A");
      expect(nodeB?.getProps().getPropData("name")).toBe("Seed");
      expect(nodeA?.getPrototype().getPorts()?.[0]?.id).toBe("A");
      expect(nodeB?.getPrototype().getPorts()?.[0]?.id).toBe("Seed");
      expect(initialized).toHaveBeenCalled();
      const identity = nodeA?.getPrototype();
      a.prototypes.register(definition("Updated A"));
      expect(nodeA?.getPrototype()).toBe(identity);
      expect(identity?.getName()).toBe("Updated A");
      expect(nodeB?.getPrototype().getName()).toBe("Seed");
    } finally {
      first.destroy();
      second.destroy();
      a.dispose();
      b.dispose();
      seed.dispose();
    }
  });
  it("preserves lazy translation accessors and replaces without retaining old registrations", () => {
    const set = registries();
    let language = "First";
    const original = definition("Seed");
    Object.defineProperty(original.meta, "name", {
      configurable: true,
      enumerable: true,
      get: () => language,
    });
    const release = set.prototypes.register(original);
    const fork = set.fork();
    language = "Second";
    expect(fork.prototypes.getPrototypeByType("same")?.getName()).toBe("Second");
    expect(
      Object.getOwnPropertyDescriptor(
        fork.prototypes.getPrototypeByType("same")!.getDefinition()!.meta,
        "name",
      )?.get,
    ).toBeDefined();
    for (let i = 0; i < 50; i++) expect(set.prototypes.replace(definition(String(i)))).toBe(true);
    release();
    expect(set.prototypes.getPrototypeByType("same")).toBeNull();
    expect(set.prototypes.replace(definition("Missing"))).toBe(false);
    set.dispose();
    fork.dispose();
  });
  it("keeps same-ID document signals separate and removes owned listeners on destroy", () => {
    const set = registries(),
      a = doc(set),
      b = doc(set);
    const first = vi.fn(),
      second = vi.fn();
    a.getSignals().onSignal("test", first);
    b.getSignals().onSignal("test", second);
    a.sendSignal("test");
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
    a.destroy();
    a.sendSignal("test");
    b.sendSignal("test");
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(a.getSignals().listenerCount("test")).toBe(0);
    b.destroy();
    set.dispose();
  });
  it("propagates explicit registries to collection children and scopes collection events", () => {
    const set = registries();
    set.prototypes.register(definition("Collection"));
    const a = new DocumentCollection({ documents: [] }, [], { registries: set });
    const b = new DocumentCollection({ documents: [] }, [], { registries: set });
    const callback = vi.fn();
    b.getSignals().onSignal("documentcollection.docadd", callback);
    const child = a.createDocument({ id: "child", documentType: "*", documentVersion: "1.0.0" });
    expect(child.getRegistries()).toBe(set);
    a.addDocument(child);
    expect(callback).not.toHaveBeenCalled();
    child.destroy();
    set.dispose();
  });
  it("identity disposers restore live registrations and never resurrect released ones", () => {
    const set = registries();
    const original = set.prototypes.register(definition("Base"));
    const overlay = set.prototypes.register(definition("Overlay"));
    original();
    original();
    expect(set.prototypes.getPrototypeByType("same")?.getName()).toBe("Overlay");
    overlay();
    expect(set.prototypes.getPrototypeByType("same")).toBeNull();
    set.dispose();
    expect(() => set.prototypes.register(definition("Late"))).toThrow("disposed");
  });
  it("isolates transformer overrides and returns registration ownership handles", () => {
    const seed = registries();
    seed.contentTypes.registerTransformer({
      format: "same",
      contentType: "*",
      transformIn: () => "base",
      transformOut: () => "base",
    });
    const a = seed.fork(),
      b = seed.fork();
    const release = a.contentTypes.registerTransformer({
      format: "same",
      contentType: "*",
      transformIn: () => "A",
      transformOut: () => "A",
    });
    expect(a.contentTypes.transform("same", null)).toBe("A");
    expect(b.contentTypes.transform("same", null)).toBe("base");
    release();
    release();
    expect(a.contentTypes.transform("same", null)).toBe("base");
    a.dispose();
    expect(b.contentTypes.transformOut("same", null)).toBe("base");
    b.dispose();
    seed.dispose();
  });
});

it("ignores selection writes from an async continuation after document disposal", async () => {
  const set = registries();
  const document = doc(set);
  let resume!: () => void;
  const gate = new Promise<void>((resolve) => {
    resume = resolve;
  });
  const operation = document.transaction("pending", async () => {
    await gate;
    document.getSelection().setKeys(["late"]);
  });
  document.destroy();
  resume();
  await operation;
  expect(document.getSelection().getKeys()).toEqual([]);
  expect(document.getTimeline().getPoints()).toHaveLength(0);
  await expect(document.transaction("late", () => {})).rejects.toThrow("destroyed");
  set.dispose();
});

it("does not finish pending removal after disposal or remove a same-ID replacement", async () => {
  const set = registries();
  set.prototypes.register(definition("Scoped"));
  for (const dispose of [true, false]) {
    const document = doc(set);
    const original = (await document.getContent().addNode({ id: "same", type: "same" }))!;
    let resume!: () => void;
    const gate = new Promise<void>((resolve) => {
      resume = resolve;
    });
    document.aspect("contentaop.noderemoving", () => gate);
    const sideEffect = vi.fn();
    const pending = document.getContent().removeNode(original, sideEffect);
    const replacement = dispose
      ? null
      : await document.getContent().addNode({ id: "same", type: "same" });
    if (dispose) document.destroy();
    resume();
    expect(await pending).toBe(false);
    expect(sideEffect).not.toHaveBeenCalled();
    if (replacement) expect(document.getContent().getNode("same")).toBe(replacement);
    document.destroy();
  }
  set.dispose();
});
it("does not delete replacement incoming relations when a pending allocation is purged", async () => {
  const set = registries();
  set.prototypes.register(definition("Scoped"));
  const document = doc(set);
  const source = (await document.getContent().addNode({ id: "source", type: "same" }))!;
  let resume!: () => void;
  const gate = new Promise<void>((resolve) => {
    resume = resolve;
  });
  let allocations = 0;
  document.aspect("contentaop.nodeadding", async () => {
    if (++allocations === 1) {
      await gate;
      return false;
    }
  });
  const pending = document.getContent().addNode({ id: "replacement", type: "same" });
  const replacement = await document.getContent().addNode({ id: "replacement", type: "same" });
  source.getRelation().addEdge({ id: "incoming", targetNodeId: "replacement" });
  resume();
  expect(await pending).toBeNull();
  expect(document.getContent().getNode("replacement")).toBe(replacement);
  expect(source.getRelation().getEdgeById("incoming")).not.toBeNull();
  document.destroy();
  set.dispose();
});

it("disposes duplicate callbacks by registration identity", () => {
  const set = registries();
  const document = doc(set);
  const callback = vi.fn();
  const release = document.getSignals().onSignal("same", callback);
  const releaseOther = document.getSignals().onSignal("same", callback);
  release();
  document.sendSignal("same");
  expect(callback).toHaveBeenCalledOnce();
  releaseOther();
  document.sendSignal("same");
  expect(callback).toHaveBeenCalledOnce();
  const changed = vi.fn();
  const releaseFirst = set.prototypes.onRegistryChange(changed);
  const releaseSecond = set.prototypes.onRegistryChange(changed);
  releaseFirst();
  set.prototypes.register(definition("Change"));
  expect(changed).toHaveBeenCalledOnce();
  releaseSecond();
  document.destroy();
  set.dispose();
});
