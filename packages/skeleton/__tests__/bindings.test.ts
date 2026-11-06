import { describe, expect, it } from "vitest";
import { Editor } from "@flow-designer/core";
import { bindSkeleton, getSkeleton } from "../src/bindings";
import { Skeleton } from "../src/skeleton";
describe("editor UI binding", () => {
  it("requires an explicit binding and keeps editors isolated", () => {
    const a = new Editor(),
      b = new Editor();
    expect(() => getSkeleton(a)).toThrow("No skeleton");
    const first = new Skeleton(),
      second = new Skeleton();
    const releaseA = bindSkeleton(a, first),
      releaseB = bindSkeleton(b, second);
    expect(getSkeleton(a)).toBe(first);
    expect(getSkeleton(b)).toBe(second);
    releaseA();
    expect(() => getSkeleton(a)).toThrow("No skeleton");
    expect(getSkeleton(b)).toBe(second);
    releaseB();
  });
  it("rejects any active duplicate, including the same skeleton", () => {
    const editor = new Editor(),
      skeleton = new Skeleton();
    const release = bindSkeleton(editor, skeleton);
    expect(() => bindSkeleton(editor, skeleton)).toThrow("already bound");
    expect(() => bindSkeleton(editor, new Skeleton())).toThrow("already bound");
    expect(getSkeleton(editor)).toBe(skeleton);
    release();
  });
  it("allows rebinding after cleanup and ignores old idempotent disposers", () => {
    const editor = new Editor(),
      skeleton = new Skeleton();
    const oldRelease = bindSkeleton(editor, skeleton);
    oldRelease();
    const release = bindSkeleton(editor, skeleton);
    oldRelease();
    expect(getSkeleton(editor)).toBe(skeleton);
    release();
    release();
    expect(() => getSkeleton(editor)).toThrow("No skeleton");
  });
});
