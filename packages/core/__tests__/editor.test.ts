import { describe, it, expect } from "vitest";
import { Editor, GraphView } from "../src/editor";
import { autorun } from "mobx";

describe("GraphView", () => {
  it("initial zoom is 1", () => {
    const gv = new GraphView();
    expect(gv.getZoom()).toBe(1);
  });

  it("setZoom updates value", () => {
    const gv = new GraphView();
    gv.setZoom(0.5);
    expect(gv.getZoom()).toBe(0.5);
  });

  it("initial editable is true", () => {
    const gv = new GraphView();
    expect(gv.getEditable()).toBe(true);
  });

  it("setEditable updates value", () => {
    const gv = new GraphView();
    gv.setEditable(false);
    expect(gv.getEditable()).toBe(false);
  });

  it("zoom is MobX observable", () => {
    const gv = new GraphView();
    const values: number[] = [];
    autorun(() => {
      values.push(gv.getZoom());
    });
    gv.setZoom(2);
    gv.setZoom(0.75);
    expect(values).toEqual([1, 2, 0.75]);
  });

  it("editable is MobX observable", () => {
    const gv = new GraphView();
    const values: boolean[] = [];
    autorun(() => {
      values.push(gv.getEditable());
    });
    gv.setEditable(false);
    gv.setEditable(true);
    expect(values).toEqual([true, false, true]);
  });
});

describe("Editor", () => {
  it("get/set skeleton", () => {
    const editor = new Editor();
    const skeleton = {
      header: {},
      sidebar: {},
      inspector: {},
      canvasToolbar: {},
      canvas: {},
      add() {},
      remove() {},
    } as any;
    editor.setSkeleton(skeleton);
    expect(editor.getSkeleton()).toBe(skeleton);
  });

  it("getGraphView returns GraphView instance", () => {
    const editor = new Editor();
    expect(editor.getGraphView()).toBeInstanceOf(GraphView);
  });

  it("extends EventEmitter", () => {
    const editor = new Editor();
    expect(typeof editor.on).toBe("function");
    expect(typeof editor.emit).toBe("function");
  });
});
