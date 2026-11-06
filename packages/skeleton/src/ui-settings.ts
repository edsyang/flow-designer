import type { ComponentType, ReactElement, ReactNode } from "react";
import type { Setting, SettingConfig } from "@flow-designer/model";
import type { FormatterConfig } from "@flow-designer/model";
import type { ChangeableConfig } from "./changeable";

export enum DisplayType {
  None = "none",
  Block = "block",
  Plain = "plain",
  Inline = "inline",
  Accordion = "accordion",
  Popup = "popup",
  Caption = "caption",
  Entry = "entry",
  Tab = "tab",
}
export type SetterComponentType = ComponentType<any> & { formater?: FormatterConfig<unknown> };
export type SetterType<T = unknown> =
  | string
  | SetterComponentType
  | ReactElement
  | { type: string; props?: Record<string, unknown>; formatter?: FormatterConfig<T> };
export type Tip = { type: string; content: ReactNode } | ReactNode;
export interface UiSettingConfig<T = any> extends Omit<SettingConfig<T>, "items"> {
  description?: string;
  tip?: Tip;
  display?: DisplayType;
  tab?: string;
  className?: string;
  setter?: SetterType<T>;
  items?: UiSettingConfig<T>[];
  behaviors?: Record<string, (setting: Setting<T>, value?: unknown) => boolean>;
  setterChangeableProps?: ChangeableConfig<T>[];
}
export interface EditorField extends Omit<
  UiSettingConfig,
  "type" | "display" | "formatter" | "items"
> {
  items?: EditorField[];
  type?: "item" | "group";
  display?: string;
  formatter?: { serialize?(value: unknown): unknown; deserialize?(value: unknown): unknown };
}
