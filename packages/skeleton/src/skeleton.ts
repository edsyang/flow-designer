import { UiContributionRegistry } from "./ui-contributions";
import type { ISkeleton, PaneConfig } from "./contracts";

import { Area } from "./area";

export class Skeleton implements ISkeleton {
  readonly ui = new UiContributionRegistry();
  header = new Area();
  sidebar = new Area();
  inspector = new Area();
  canvasToolbar = new Area();
  canvas = new Area();

  add(config: PaneConfig) {
    const { area } = config;
    switch (area) {
      case "header":
        this.header.add(config);
        break;
      case "canvasToolbar":
        this.canvasToolbar.add(config);
        break;
      case "sidebar":
        this.sidebar.add(config);
        break;
      case "inspector":
        this.inspector.add(config);
        break;
      case "canvas":
        this.canvas.add(config);
        break;
    }
  }

  remove(key: string) {
    this.header.remove(key);
    this.canvasToolbar.remove(key);
    this.sidebar.remove(key);
    this.inspector.remove(key);
    this.canvas.remove(key);
  }
}
