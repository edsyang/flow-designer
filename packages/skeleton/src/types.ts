import type { ReactNode } from 'react';
import type { Setting, ContentNode, Settings } from '@flow-designer/model';

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
  node?: ContentNode | null;
  settings?: Settings<any>;
}

export interface SettingFieldProps {
  setting: Setting<any>;
  className?: string;
}
