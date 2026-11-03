import { Radio } from "antd";
import type { RadioGroupSetterProps } from "./types";

export function RadioGroupSetter({
  value,
  onChange,
  disabled,
  options,
  direction = "horizontal",
}: RadioGroupSetterProps) {
  return (
    <Radio.Group
      size="small"
      value={value}
      disabled={disabled}
      onChange={(e) => {
        onChange(e.target.value as string);
      }}
      style={
        direction === "vertical" ? { display: "flex", flexDirection: "column", gap: 4 } : undefined
      }
    >
      {options.map((opt) => (
        <Radio key={opt.value} value={opt.value}>
          {opt.label}
        </Radio>
      ))}
    </Radio.Group>
  );
}
