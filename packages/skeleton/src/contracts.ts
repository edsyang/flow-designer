import type { ComponentType, ReactElement } from "react";

export type AreaMountCallback = (container: HTMLElement) => void | (() => void);

export interface ISkeleton {
  header: IArea;
  sidebar: IArea;
  inspector: IArea;
  canvasToolbar: IArea;
  canvas: IArea;
  add(config: PaneConfig): void;
  remove(key: string): void;
}

export interface IArea {
  add(config: PaneConfig): void;
  remove(key: string): void;
  setVisible(visible: boolean): void;
  getVisible(): boolean;
  getItems(): PaneConfig[];
  getDidMountCallbacks(): AreaMountCallback[];
  hooks: { didMount(cb: AreaMountCallback): () => void };
}

export interface PaneConfig {
  key: string;
  area: "canvasToolbar" | "header" | "canvas" | "inspector" | "sidebar";
  align?: "left" | "right" | "center";
  content: string | ReactElement | ComponentType<any>;
  contentProps?: Record<string, unknown>;
}
