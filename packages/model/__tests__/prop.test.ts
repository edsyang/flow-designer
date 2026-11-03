import { describe, it, expect } from "vitest";
import Prop from "../src/props/prop";
import Props from "../src/props";

describe("Prop", () => {
  it("getData returns cloned initial data", () => {
    const data = { a: 1, b: [2, 3] };
    const prop = new Prop(null, null, data);
    const result = prop.getData();
    expect(result).toEqual(data);
    expect(result).not.toBe(data);
  });

  it("setData modifies and returns true", () => {
    const prop = new Prop(null, null, { x: 1 });
    const modified = prop.setData({ x: 2 });
    expect(modified).toBe(true);
    expect(prop.getData()).toEqual({ x: 2 });
  });

  it("setData with same value returns false for scalars", () => {
    const prop = new Prop(null, null, 42);
    const modified = prop.setData(42);
    expect(modified).toBe(false);
  });

  it("getPropData and setPropData work with paths", () => {
    const prop = new Prop(null, null, { nested: { value: 10 } });
    expect(prop.getPropData("nested")).toEqual({ value: 10 });
    prop.setPropData("nested", { value: 20 });
    expect(prop.getPropData("nested")).toEqual({ value: 20 });
  });

  it("push adds to list", () => {
    const prop = new Prop(null, null, [1, 2]);
    prop.push(3);
    expect(prop.getData()).toEqual([1, 2, 3]);
  });

  it("mergeData merges maps", () => {
    const prop = new Prop(null, null, { a: 1, b: 2 });
    prop.mergeData({ b: 3, c: 4 });
    const data = prop.getData();
    expect(data.a).toBe(1);
    expect(data.b).toBe(3);
    expect(data.c).toBe(4);
  });

  it("getItems returns child props for map", () => {
    const prop = new Prop(null, null, { x: 1, y: 2 });
    const items = prop.getItems();
    expect(items).toHaveLength(2);
    expect(items[0].getKey()).toBe("x");
    expect(items[1].getKey()).toBe("y");
  });
});

describe("Props", () => {
  it("getData returns initial data", () => {
    const props = new Props({}, { name: "test", value: 42 });
    const data = props.getData();
    expect(data.name).toBe("test");
    expect(data.value).toBe(42);
  });

  it("getOwner returns the owner", () => {
    const owner = { id: "owner" };
    const props = new Props(owner, {});
    expect(props.getOwner()).toBe(owner);
  });

  it("setPropData triggers syncchange", () => {
    const props = new Props({}, { x: 1 });
    let changed = false;
    props.onSyncChange(() => {
      changed = true;
    });
    props.setPropData("x", 2);
    expect(changed).toBe(true);
  });
});
