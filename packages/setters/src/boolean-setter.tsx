import { Switch } from "antd";
import type { SetterProps } from "./types";

export function BooleanSetter({ value, onChange, disabled }: SetterProps<boolean>) {
  return (
    <Switch
      size="small"
      checked={value ?? false}
      disabled={disabled}
      onChange={(checked) => {
        onChange(checked);
      }}
    />
  );
}
