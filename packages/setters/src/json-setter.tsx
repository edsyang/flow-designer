import { useState } from "react";
import { Input } from "antd";
import type { SetterProps } from "./types";

export function JsonSetter({ value, onChange, disabled }: SetterProps<object>) {
  const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 2));
  const [error, setError] = useState(false);

  const handleBlur = () => {
    try {
      const parsed: object = JSON.parse(text);
      setError(false);
      onChange(parsed);
    } catch {
      setError(true);
    }
  };

  return (
    <Input.TextArea
      style={{ fontFamily: "monospace", fontSize: 12 }}
      status={error ? "error" : undefined}
      value={text}
      disabled={disabled}
      autoSize={{ minRows: 4 }}
      onChange={(e) => {
        setText(e.target.value);
        setError(false);
      }}
      onBlur={handleBlur}
    />
  );
}
