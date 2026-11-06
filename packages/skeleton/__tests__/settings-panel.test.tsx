import { Component, createRef, forwardRef, memo } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Props, Settings } from "@flow-designer/model";
import { DisplayType } from "../src/ui-settings";
import { UiContributionRegistry } from "../src/ui-contributions";
const contributions = new UiContributionRegistry();
const setterRegistry = contributions.setters;
import type { UiSettingConfig as SettingConfig } from "../src/ui-settings";
import { SettingsPanel } from "../src/settings-panel";

interface InputProps {
  value?: unknown;
  onChange?: (value: string) => void;
  title?: string;
}
const Input = ({ value, onChange, title }: InputProps) => (
  <input
    aria-label="value"
    title={title}
    value={String(value ?? "")}
    onChange={(event) => onChange?.(event.target.value)}
  />
);
class ClassInput extends Component<InputProps> {
  render() {
    return <Input {...this.props} />;
  }
}
const ForwardInput = forwardRef<HTMLInputElement, InputProps>(({ value, onChange }, ref) => (
  <input
    aria-label="value"
    ref={ref}
    value={String(value ?? "")}
    onChange={(event) => onChange?.(event.target.value)}
  />
));

describe("SettingsPanel setter rendering", () => {
  afterEach(cleanup);

  it("uses direct function, class, memo and forwardRef setters rather than the default", () => {
    const setters: Array<SettingConfig<object>["setter"]> = [
      Input,
      ClassInput,
      memo(Input),
      ForwardInput,
      memo(ForwardInput),
    ];
    setterRegistry.register("shared-render-default", () => <span>fallback</span>, true);
    for (const setter of setters) {
      const props = new Props({}, { value: "initial" });
      const settings = new Settings(
        props,
        contributions.compileSettings(
          [{ target: "value", display: DisplayType.Plain, setter }],
          "test",
        ),
      );
      const view = render(<SettingsPanel settings={settings} contributions={contributions} />);
      const input = view.getByRole<HTMLInputElement>("textbox");
      expect(input.value).toBe("initial");
      fireEvent.change(input, { target: { value: "edited" } });
      expect(props.getPropData("value")).toBe("edited");
      expect(view.queryByText("fallback")).toBeNull();
      view.unmount();
      settings.didPurge();
      props.didPurge();
    }
  });

  it("preserves element refs and lets computed setting props override element props", () => {
    const ref = createRef<HTMLInputElement>();
    const props = new Props({}, { value: "model" });
    const settings = new Settings(
      props,
      contributions.compileSettings(
        [
          {
            target: "value",
            display: DisplayType.Plain,
            setter: <ForwardInput key="setter" ref={ref} value="element" />,
          },
        ],
        "test",
      ),
    );
    const view = render(<SettingsPanel settings={settings} contributions={contributions} />);
    expect(ref.current).toBe(view.getByRole("textbox"));
    expect(ref.current?.value).toBe("model");
    fireEvent.change(view.getByRole("textbox"), { target: { value: "changed" } });
    expect(props.getPropData("value")).toBe("changed");
    view.unmount();
    settings.didPurge();
    props.didPurge();
  });

  it("keeps registered string and config setters with existing props precedence", () => {
    setterRegistry.register("shared-render-input", Input);
    for (const setter of [
      "shared-render-input",
      { type: "shared-render-input", title: "extra", props: { title: "config", value: "ignored" } },
    ]) {
      const props = new Props({}, { value: "model" });
      const settings = new Settings(
        props,
        contributions.compileSettings(
          [{ target: "value", display: DisplayType.Plain, setter }],
          "test",
        ),
      );
      const view = render(<SettingsPanel settings={settings} contributions={contributions} />);
      const input = view.getByRole<HTMLInputElement>("textbox");
      expect(input.value).toBe("model");
      if (typeof setter !== "string") expect(input.title).toBe("config");
      view.unmount();
      settings.didPurge();
      props.didPurge();
    }
  });
});
