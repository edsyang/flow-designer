import { describe, it, expect, vi } from "vitest";
import { CommandRegistry } from "../src/command";

describe("CommandRegistry", () => {
  it("register and execute a command", () => {
    const reg = new CommandRegistry();
    const fn = vi.fn();
    reg.register("test", fn);
    reg.executeCommand("test", "a", "b");
    expect(fn).toHaveBeenCalledWith("a", "b");
  });

  it("executeCommand spreads params correctly (bug fix)", () => {
    const reg = new CommandRegistry();
    const fn = vi.fn();
    reg.register("multi", fn);
    reg.executeCommand("multi", 1, 2, 3);
    expect(fn).toHaveBeenCalledWith(1, 2, 3);
    expect(fn.mock.calls[0]).toEqual([1, 2, 3]);
  });

  it("executeCommand does nothing for unregistered command", () => {
    const reg = new CommandRegistry();
    expect(() => reg.executeCommand("nope")).not.toThrow();
  });

  it("hasCommand returns true/false", () => {
    const reg = new CommandRegistry();
    expect(reg.hasCommand("x")).toBe(false);
    reg.register("x", () => {});
    expect(reg.hasCommand("x")).toBe(true);
  });

  it("unregister removes command", () => {
    const reg = new CommandRegistry();
    reg.register("y", () => {});
    expect(reg.unregister("y")).toBe(true);
    expect(reg.hasCommand("y")).toBe(false);
  });

  it("unregister returns false for non-existent", () => {
    const reg = new CommandRegistry();
    expect(reg.unregister("nope")).toBe(false);
  });

  it("getRegistry returns a query snapshot", () => {
    const reg = new CommandRegistry();
    const fn = () => {};
    reg.register("cmd", fn);
    expect(reg.getRegistry().get("cmd")).toBe(fn);
  });

  it("register overwrites existing command", () => {
    const reg = new CommandRegistry();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    reg.register("dup", fn1);
    reg.register("dup", fn2);
    reg.executeCommand("dup");
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalled();
  });
});

describe("command completion", () => {
  it("returns synchronous results and the original promise so callers can await completion", async () => {
    const registry = new CommandRegistry();
    registry.register("value", () => 42);
    expect(registry.executeCommand("value")).toBe(42);
    const result = Promise.resolve("completed");
    registry.register("async", () => result);
    expect(registry.executeCommand("async")).toBe(result);
    await expect(registry.executeCommand("async")).resolves.toBe("completed");
  });
  it("propagates rejected asynchronous commands to the caller", async () => {
    const registry = new CommandRegistry();
    registry.register("failure", async () => {
      throw new Error("command failure");
    });
    await expect(registry.executeCommand("failure")).rejects.toThrow("command failure");
  });
});
