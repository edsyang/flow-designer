import { describe, expect, it, vi } from "vitest";
import { Editor } from "../src/editor";
import { CommandRegistry } from "../src/command";
import { DisposableScope, CleanupError } from "../src/disposable-scope";
import { NotificationCenter } from "../src/notifications";
import { RegistrySet, Document, GenericContent } from "@flow-designer/model";
describe("editor instance services", () => {
  it("keeps same-name commands independent and releases by registration identity", () => {
    const a = new Editor(),
      b = new Editor();
    const old = a.commands.register("same", () => "old");
    const release = a.commands.register("same", () => "A");
    b.commands.register("same", () => "B");
    old();
    expect(a.commands.executeCommand("same")).toBe("A");
    expect(b.commands.executeCommand("same")).toBe("B");
    release();
    expect(a.commands.hasCommand("same")).toBe(false);
    a.dispose();
    expect(b.commands.executeCommand("same")).toBe("B");
    b.dispose();
  });
  it("returns snapshots rather than an externally mutable command map", () => {
    const registry = new CommandRegistry();
    registry.register("kept", () => 1);
    registry.getRegistry().clear();
    expect(registry.executeCommand("kept")).toBe(1);
  });
  it("requires an explicit registry identity to agree with its attached document", () => {
    const registries = new RegistrySet();
    registries.contentTypes.register(GenericContent);
    const document = new Document({ id: "doc", documentType: "*", documentVersion: "1.0.0" }, [], {
      registries,
    });
    const editor = new Editor({ registries });
    editor.setDocument(document);
    expect(editor.getRegistries()).toBe(document.getRegistries());
    const other = new Editor({ registries: registries.fork() });
    expect(() => other.setDocument(document)).toThrow("same registries");
    document.destroy();
    editor.dispose();
    other.getRegistries().dispose();
    other.dispose();
    registries.dispose();
  });
  it("scopes notification sinks and supports cleanup/rebind without stale disposal", () => {
    const a = new NotificationCenter(),
      b = new NotificationCenter();
    const first = vi.fn(),
      second = vi.fn(),
      replacement = vi.fn();
    const release = a.bindSink(first);
    b.bindSink(second);
    expect(() => a.bindSink(first)).toThrow("already bound");
    a.notify({ level: "success", message: "A" });
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
    release();
    const cleanup = a.bindSink(replacement);
    release();
    a.notify({ level: "success", message: "new A" });
    expect(replacement).toHaveBeenCalledOnce();
    cleanup();
    a.dispose();
    a.notify({ level: "error", message: "late" });
    b.notify({ level: "success", message: "B" });
    expect(second).toHaveBeenCalledOnce();
    b.dispose();
  });
  it("cleans every resource in reverse order and exposes all errors", async () => {
    const scope = new DisposableScope();
    const order: number[] = [];
    const first = new Error("first"),
      last = new Error("last");
    scope.add(() => {
      order.push(1);
      throw first;
    });
    const early = scope.add(() => {
      order.push(2);
    });
    scope.add(async () => {
      order.push(3);
      throw last;
    });
    await early();
    const destruction = scope.dispose();
    expect(scope.dispose()).toBe(destruction);
    await expect(destruction).rejects.toBeInstanceOf(CleanupError);
    await expect(destruction).rejects.toMatchObject({ errors: [last, first] });
    expect(order).toEqual([2, 3, 1]);
    expect(() => scope.add(() => {})).toThrow("closed");
  });
});
