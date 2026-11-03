import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { StringSetter } from "../src/string-setter";
import { NumberSetter } from "../src/number-setter";
import { BooleanSetter } from "../src/boolean-setter";
import { SelectSetter } from "../src/select-setter";
import { JsonSetter } from "../src/json-setter";
import { ColorSetter } from "../src/color-setter";
import { TextAreaSetter } from "../src/textarea-setter";
import { RadioGroupSetter } from "../src/radio-group-setter";
import { BuiltinSetters } from "../src/builtin-setters";
import { registerBuiltinSetters } from "../src/register-builtin-setters";
import type { BuiltinSetterName } from "../src/builtin-setters";

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
});

describe("StringSetter", () => {
  it("renders input with value", () => {
    const { container } = render(<StringSetter value="hello" onChange={() => {}} />);
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("hello");
  });

  it("calls onChange on input", () => {
    const onChange = vi.fn();
    const { container } = render(<StringSetter value="" onChange={onChange} />);
    fireEvent.change(container.querySelector("input")!, { target: { value: "new" } });
    expect(onChange).toHaveBeenCalledWith("new");
  });

  it("respects disabled state", () => {
    const { container } = render(<StringSetter value="" onChange={() => {}} disabled />);
    expect((container.querySelector("input") as HTMLInputElement).disabled).toBe(true);
  });
});

describe("NumberSetter", () => {
  it("renders input with value", () => {
    const { container } = render(<NumberSetter value={42} onChange={() => {}} />);
    expect((container.querySelector("input") as HTMLInputElement).value).toBe("42");
  });

  it("calls onChange with number value", () => {
    const onChange = vi.fn();
    const { container } = render(<NumberSetter value={0} onChange={onChange} />);
    fireEvent.change(container.querySelector("input")!, { target: { value: "10" } });
    expect(onChange).toHaveBeenCalledWith(10);
  });
});

describe("BooleanSetter", () => {
  it("renders switch with checked state", () => {
    const { container } = render(<BooleanSetter value={true} onChange={() => {}} />);
    const switchBtn = container.querySelector('button[role="switch"]') as HTMLButtonElement;
    expect(switchBtn).toBeTruthy();
    expect(switchBtn.getAttribute("aria-checked")).toBe("true");
  });

  it("calls onChange on toggle", () => {
    const onChange = vi.fn();
    const { container } = render(<BooleanSetter value={false} onChange={onChange} />);
    fireEvent.click(container.querySelector('button[role="switch"]')!);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("SelectSetter", () => {
  const options = [
    { label: "Apple", value: "apple" },
    { label: "Banana", value: "banana" },
  ];

  it("renders select component", () => {
    const { container } = render(
      <SelectSetter value="apple" onChange={() => {}} options={options} />,
    );
    const selectEl = container.querySelector(".ant-select");
    expect(selectEl).toBeTruthy();
  });
});

describe("JsonSetter", () => {
  it("renders textarea with stringified JSON", () => {
    const { container } = render(<JsonSetter value={{ key: "val" }} onChange={() => {}} />);
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea.value).toBe('{\n  "key": "val"\n}');
  });

  it("calls onChange with parsed JSON on valid blur", () => {
    const onChange = vi.fn();
    const { container } = render(<JsonSetter value={{}} onChange={onChange} />);
    const textarea = container.querySelector("textarea")!;
    fireEvent.change(textarea, { target: { value: '{"a":1}' } });
    fireEvent.blur(textarea);
    expect(onChange).toHaveBeenCalledWith({ a: 1 });
  });

  it("does not call onChange on invalid JSON blur", () => {
    const onChange = vi.fn();
    const { container } = render(<JsonSetter value={{}} onChange={onChange} />);
    const textarea = container.querySelector("textarea")!;
    fireEvent.change(textarea, { target: { value: "{bad}" } });
    fireEvent.blur(textarea);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("ColorSetter", () => {
  it("renders color picker component", () => {
    const { container } = render(<ColorSetter value="#ff0000" onChange={() => {}} />);
    const picker = container.querySelector(".ant-color-picker-trigger");
    expect(picker).toBeTruthy();
  });
});

describe("TextAreaSetter", () => {
  it("renders textarea with value", () => {
    const { container } = render(<TextAreaSetter value="long text" onChange={() => {}} />);
    expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("long text");
  });
});

describe("RadioGroupSetter", () => {
  const options = [
    { label: "Yes", value: "yes" },
    { label: "No", value: "no" },
  ];

  it("renders radio buttons", () => {
    const { container } = render(
      <RadioGroupSetter value="yes" onChange={() => {}} options={options} />,
    );
    const radios = container.querySelectorAll(
      'input[type="radio"]',
    ) as NodeListOf<HTMLInputElement>;
    expect(radios).toHaveLength(2);
    expect(radios[0].checked).toBe(true);
    expect(radios[1].checked).toBe(false);
  });

  it("calls onChange on selection", () => {
    const onChange = vi.fn();
    const { container } = render(
      <RadioGroupSetter value="yes" onChange={onChange} options={options} />,
    );
    const radios = container.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[1]);
    expect(onChange).toHaveBeenCalledWith("no");
  });
});

describe("BuiltinSetters", () => {
  it("maps all 8 setter names", () => {
    expect(Object.keys(BuiltinSetters)).toHaveLength(8);
    expect(BuiltinSetters.String).toBe("StringSetter");
    expect(BuiltinSetters.Json).toBe("JsonSetter");
  });

  it("type is assignable to BuiltinSetterName", () => {
    const name: BuiltinSetterName = BuiltinSetters.Color;
    expect(name).toBe("ColorSetter");
  });
});

describe("registerBuiltinSetters", () => {
  it("registers all 8 setters with StringSetter as default", () => {
    const registry = { register: vi.fn() };
    registerBuiltinSetters(registry);
    expect(registry.register).toHaveBeenCalledTimes(8);
    expect(registry.register).toHaveBeenCalledWith("StringSetter", expect.any(Function), true);
    expect(registry.register).toHaveBeenCalledWith("NumberSetter", expect.any(Function));
    expect(registry.register).toHaveBeenCalledWith("BooleanSetter", expect.any(Function));
    expect(registry.register).toHaveBeenCalledWith("SelectSetter", expect.any(Function));
    expect(registry.register).toHaveBeenCalledWith("JsonSetter", expect.any(Function));
    expect(registry.register).toHaveBeenCalledWith("ColorSetter", expect.any(Function));
    expect(registry.register).toHaveBeenCalledWith("TextAreaSetter", expect.any(Function));
    expect(registry.register).toHaveBeenCalledWith("RadioGroupSetter", expect.any(Function));
  });
});
