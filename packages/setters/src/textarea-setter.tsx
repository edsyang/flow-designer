import { Input } from "antd";
import type { SetterProps } from "./types";

export function TextAreaSetter({ value, onChange, disabled }: SetterProps<string>) {
  return (
    <Input.TextArea
      value={value ?? ""}
      disabled={disabled}
      autoSize={{ minRows: 3 }}
      onChange={(e) => {
        onChange(e.target.value);
      }}
    />
  );
}
