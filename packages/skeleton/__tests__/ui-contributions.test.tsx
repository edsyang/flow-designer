import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, cleanup, act } from "@testing-library/react";
import { Props, Settings, PrototypeRegistry } from "@flow-designer/model";
import { defineNode } from "../../engine/src/definitions";
import { UiContributionRegistry } from "../src/ui-contributions";
import { SettingsPanel } from "../src/settings-panel";
import { UiSetting } from "../src/ui-setting";
import { DisplayType } from "../src/ui-settings";
const definition = (name: string) =>
  defineNode({
    meta: { name, typeName: "task" },
    view: { type: "node", shape: "fd-rect" },
    schema: [],
    editor: [{ target: "value", description: name, setter: "custom" }],
  });
describe("owned UI contributions", () => {
  it("keeps identical-name setters isolated and releases overlays by identity", () => {
    const first = new UiContributionRegistry(),
      second = new UiContributionRegistry();
    const a = () => null,
      b = () => null;
    const releaseA = first.setters.register("custom", a),
      releaseB = first.setters.register("custom", b);
    second.setters.register("custom", a);
    releaseA();
    expect(first.setters.getSetter("custom")).toBe(b);
    expect(second.setters.getSetter("custom")).toBe(a);
    releaseB();
    expect(first.setters.getSetter("custom")).toBeNull();
    first.dispose();
    second.dispose();
  });
  it("preserves registration ownership across replacement, repeated bundle identity and external domain overlays", () => {
    const ui = new UiContributionRegistry(),
      domain = new PrototypeRegistry();
    const bundle = definition("base");
    const first = ui.register(bundle, domain),
      second = ui.register(bundle, domain);
    first();
    expect(ui.getNode("task")?.meta.name).toBe("base");
    ui.replace(definition("replacement"), domain);
    const external = domain.register({ meta: { name: "external", typeName: "task" }, schema: [] });
    ui.replace(definition("latest"), domain);
    expect(domain.getPrototypeByType("task")?.getName()).toBe("external");
    external();
    expect(domain.getPrototypeByType("task")?.getName()).toBe("latest");
    second();
    expect(domain.getPrototypeByType("task")).toBeNull();
    expect(ui.getNodes()).toEqual([]);
    expect(bundle.meta.name).toBe("base");
    ui.dispose();
    domain.dispose();
  });
  it("clones each editor contribution and gives duplicate listeners independent cleanup", () => {
    const a = new UiContributionRegistry(),
      b = new UiContributionRegistry(),
      ad = new PrototypeRegistry(),
      bd = new PrototypeRegistry();
    const bundle = definition("original");
    a.register(bundle, ad);
    b.register(bundle, bd);
    a.getNode("task")!.meta.name = "changed";
    expect(b.getNode("task")?.meta.name).toBe("original");
    expect(bundle.meta.name).toBe("original");
    const listener = vi.fn(),
      off = a.onChange(listener);
    const off2 = a.onChange(listener);
    off();
    a.replace(definition("next"), ad);
    expect(listener).toHaveBeenCalledTimes(1);
    off2();
    a.dispose();
    b.dispose();
    ad.dispose();
    bd.dispose();
  });
  it("does not re-read caller ports when an owned contribution is refreshed", () => {
    const ui = new UiContributionRegistry(),
      domain = new PrototypeRegistry();
    const bundle = definition("original");
    bundle.view.ports = [{ id: "original", group: "out", position: "right" }];
    ui.register(bundle, domain);
    bundle.view.ports[0]!.id = "caller-mutated";
    const owned = ui.getNode("task")!;
    ui.replace(owned, domain);
    expect(owned.view.ports?.[0]?.id).toBe("original");
    expect(domain.getPrototypeByType("task")?.getPorts()[0]?.id).toBe("original");
    ui.dispose();
    domain.dispose();
  });
  it("compiles config and custom setter codecs in the existing order and preserves null", () => {
    const ui = new UiContributionRegistry();
    const calls: string[] = [];
    const custom = Object.assign(() => null, {
      formater: {
        formatIn: (_: unknown, value: unknown) => {
          calls.push("setterIn");
          return value;
        },
        formatOut: (_: unknown, value: unknown) => {
          calls.push("setterOut");
          return value;
        },
      },
    });
    ui.setters.register("custom", custom);
    const props = new Props({}, { value: "stored" });
    const configs = ui.compileSettings(
      [
        {
          target: "value",
          setter: "custom",
          formatter: {
            formatIn: () => {
              calls.push("configIn");
              return null;
            },
            formatOut: (_, value) => {
              calls.push("configOut");
              return value;
            },
          },
        },
      ],
      "document",
    );
    const settings = new Settings(props, configs);
    const field = settings.getItems()[0]!;
    expect(field.getValue()).toBeNull();
    expect(calls).toEqual(["configIn", "setterIn"]);
    field.setValue("edited");
    expect(calls.slice(-2)).toEqual(["setterOut", "configOut"]);
    expect(props.getPropData("value")).toBe("edited");
    expect("setter" in configs[0]!).toBe(false);
    settings.didPurge();
    props.didPurge();
    ui.dispose();
  });
  it("updates behaviors and dynamic setter props with domain values and releases listeners on unmount", () => {
    const ui = new UiContributionRegistry(),
      released = vi.fn();
    let notify = () => {};
    const props = new Props({}, { value: "initial" });
    const settings = new Settings(
      props,
      ui.compileSettings(
        [
          {
            target: "value",
            description: "Value",
            display: DisplayType.Block,
            setter: ({
              value,
              onChange,
              title,
            }: {
              value: string;
              onChange: (value: string) => void;
              title?: string;
            }) => (
              <input
                aria-label="value"
                value={value}
                title={title}
                onChange={(event) => onChange(event.target.value)}
              />
            ),
            behaviors: { disabled: (field) => field.getValue() === "locked" },
            setterChangeableProps: [
              {
                name: "title",
                compute: (field) => String(field.getValue()),
                listen: (_, callback) => {
                  notify = callback;
                  return released;
                },
              },
            ],
          },
        ],
        "document",
      ),
    );
    const rawField = settings.getItems()[0]!;
    const session = new UiSetting(rawField, ui.getField(rawField.getKey())!);
    expect(session.getBehaviors().disabled).toBe(false);
    const view = render(<SettingsPanel settings={settings} contributions={ui} />);
    expect(view.getByRole("textbox").getAttribute("title")).toBe("initial");
    fireEvent.change(view.getByRole("textbox"), { target: { value: "edited" } });
    act(notify);
    expect(props.getPropData("value")).toBe("edited");
    fireEvent.change(view.getByRole("textbox"), { target: { value: "locked" } });
    expect(session.getBehaviors().disabled).toBe(true);
    view.unmount();
    expect(released).toHaveBeenCalledTimes(1);
    settings.didPurge();
    props.didPurge();
    ui.dispose();
    cleanup();
  });
});
