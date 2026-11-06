import type { UiContributionRegistry } from "./ui-contributions";
import type { ReactNode } from "react";
import type { Setting, ContentNode, Settings } from "@flow-designer/model";

export interface FieldBehaviors {
  [key: string]: boolean;
}

export interface FieldProps {
  behaviors?: FieldBehaviors;
  display?: string;
  title?: string;
  tip?: any;
  className?: string;
  isGroup?: boolean;
  onBehaviorChange?: (field: string, flag: boolean) => void;
  compact?: boolean;
  children?: ReactNode;
}

export interface SettingsPanelProps {
  contributions?: UiContributionRegistry;
  node?: ContentNode | null;
  settings?: Settings<unknown>;
}

export interface SettingFieldProps {
  contributions?: UiContributionRegistry;
  setting: Setting<unknown>;
  className?: string;
}
