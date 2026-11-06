import { describe, it, expect } from "vitest";
import { SetterRegistry } from "../src/setter-registry";
describe("SetterRegistry", () => {
  it("register and getSetter", () => {
    const reg = new SetterRegistry();
    const setter = () => null;
    reg.register("text", setter as any);
    expect(reg.getSetter("text")).toBe(setter);
  });

  it("getRegistry returns all registered setters", () => {
    const reg = new SetterRegistry();
    const s1 = () => null;
    const s2 = () => null;
    reg.register("a", s1 as any);
    reg.register("b", s2 as any);
    expect(reg.getRegistry()).toHaveLength(2);
    expect(reg.getRegistry()).toContain(s1);
    expect(reg.getRegistry()).toContain(s2);
  });

  it("getDefaultSetter returns setter set as default", () => {
    const reg = new SetterRegistry();
    const s1 = () => null;
    const s2 = () => null;
    reg.register("a", s1 as any);
    reg.register("b", s2 as any, true);
    expect(reg.getDefaultSetter()).toBe(s2);
  });

  it("getSetter returns null for unknown type", () => {
    const reg = new SetterRegistry();
    expect(reg.getSetter("unknown")).toBeNull();
  });
});
