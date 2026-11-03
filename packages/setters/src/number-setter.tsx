import { InputNumber as AntInputNumber } from "antd";
import type { NumberSetterProps } from "./types";

export function NumberSetter({ value, onChange, disabled, min, max, step }: NumberSetterProps) {
  return (
    <AntInputNumber
      size="small"
      style={{ width: "100%" }}
      value={value}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      onChange={(v) => {
        onChange(v ?? 0);
      }}
    />
  );
}
