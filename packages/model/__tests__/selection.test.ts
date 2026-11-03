import { describe, it, expect, beforeEach } from "vitest";
import Selection from "../src/document/selection";
import Document from "../src/document";
import type { DocumentData } from "../src/document";
import GenericContent from "../src/content/generic";

const contentTypesRegistry = await import("../src/registries").then((m) => m.contentTypesRegistry);
const prototypeRegistry = await import("../src/registries").then((m) => m.prototypeRegistry);

function setup() {
  if (!contentTypesRegistry.getSuitableContentType("*")) {
    contentTypesRegistry.register(GenericContent as any);
  }
  if (!prototypeRegistry.getPrototypeByType("Unknown")) {
    prototypeRegistry.register({
      name: "Unknown",
      typeName: "Unknown",
      view: { type: "node", pulled: false, shape: () => null },
    } as any);
  }
}

function createDoc(): Document {
  return new Document({
    id: "doc-sel",
    documentType: "*",
    documentVersion: "1.0.0",
    nodes: [],
  });
}

describe("Selection", () => {
  beforeEach(() => {
    setup();
  });

  it("starts empty", () => {
    const doc = createDoc();
    const sel = doc.getSelection();
    expect(sel.getKeys()).toEqual([]);
    expect(sel.length).toBe(0);
  });

  it("addKey adds unique keys", () => {
    const doc = createDoc();
    const sel = doc.getSelection();
    sel.addKey("a");
    sel.addKey("b");
    sel.addKey("a");
    expect(sel.getKeys()).toEqual(["a", "b"]);
    expect(sel.length).toBe(2);
  });

  it("setKeys replaces all keys", () => {
    const doc = createDoc();
    const sel = doc.getSelection();
    sel.addKey("a");
    sel.setKeys(["x", "y"]);
    expect(sel.getKeys()).toEqual(["x", "y"]);
  });

  it("removeKey removes specific key", () => {
    const doc = createDoc();
    const sel = doc.getSelection();
    sel.setKeys(["a", "b", "c"]);
    sel.removeKey("b");
    expect(sel.getKeys()).toEqual(["a", "c"]);
  });

  it("removeKey is no-op for missing key", () => {
    const doc = createDoc();
    const sel = doc.getSelection();
    sel.setKeys(["a"]);
    sel.removeKey("zzz");
    expect(sel.getKeys()).toEqual(["a"]);
  });

  it("clear empties selection", () => {
    const doc = createDoc();
    const sel = doc.getSelection();
    sel.setKeys(["a", "b"]);
    sel.clear();
    expect(sel.getKeys()).toEqual([]);
    expect(sel.length).toBe(0);
  });

  it("getDocument returns owning document", () => {
    const doc = createDoc();
    const sel = doc.getSelection();
    expect(sel.getDocument()).toBe(doc);
  });

  it("onSelectionSyncChange fires on change", () => {
    const doc = createDoc();
    const sel = doc.getSelection();
    let lastKeys: string[] = [];
    sel.onSelectionSyncChange((keys) => {
      lastKeys = keys;
    });
    sel.setKeys(["x"]);
    expect(lastKeys).toEqual(["x"]);
  });

  it("onSelectionSyncChange unsubscribes", () => {
    const doc = createDoc();
    const sel = doc.getSelection();
    let callCount = 0;
    const unsub = sel.onSelectionSyncChange(() => {
      callCount++;
    });
    sel.setKeys(["a"]);
    expect(callCount).toBe(1);
    unsub();
    sel.setKeys(["b"]);
    expect(callCount).toBe(1);
  });
});
