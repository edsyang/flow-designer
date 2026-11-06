import type { ComponentType } from "react";
import type { ContentNode } from "@flow-designer/model";
import type { UiSetting } from "@flow-designer/skeleton";

export interface SetterProps<V = unknown> {
  value: V;
  onChange: (value: V) => void;
  field: UiSetting<ContentNode>;
  disabled?: boolean;
}

export interface NumberSetterProps extends SetterProps<number> {
  min?: number;
  max?: number;
  step?: number;
}

export interface SelectSetterProps extends SetterProps<string> {
  options: Array<{ label: string; value: string }>;
  multiple?: boolean;
}

export interface RadioGroupSetterProps extends SetterProps<string> {
  options: Array<{ label: string; value: string }>;
  direction?: "horizontal" | "vertical";
}

export type SetterComponent<P extends SetterProps = SetterProps> = ComponentType<P>;
