import { ColorPicker } from "antd";
import type { SetterProps } from "./types";

export function ColorSetter({ value, onChange, disabled }: SetterProps<string>) {
  return (
    <ColorPicker
      size="small"
      value={value ?? "#000000"}
      disabled={disabled}
      onChange={(_, hex) => {
        onChange(hex);
      }}
    />
  );
}
