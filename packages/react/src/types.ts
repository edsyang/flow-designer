import type { ReactNode } from "react";
import type { Editor } from "@flow-designer/core";
import type { Skeleton } from "@flow-designer/skeleton";

export interface EngineShape {
  editor: Editor;
  skeleton: Skeleton;
}

export interface WorkbenchProps {
  engine: EngineShape;
  className?: string;
  documentTitleKey?: string;
}

export interface FlowDesignerProviderProps {
  engine: EngineShape;
  children: ReactNode;
}
