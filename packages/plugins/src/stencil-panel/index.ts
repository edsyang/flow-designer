import type { IPluginConfig, IPluginContext } from "@flow-designer/core";
import type { GraphManager } from "@flow-designer/graph";
import { signal } from "@flow-designer/model";
import { StencilContainer } from "./stencil-container";

export function pluginStencilPanel(ctx: IPluginContext): IPluginConfig {
  let unsubGraphReady: (() => void) | null = null;

  return {
    name: "plugin-stencil-panel",
    dep: ["plugin-x6-graph"],
    init() {
      const graphManager = (ctx.plugins["plugin-x6-graph"] as { graphManager: GraphManager })
        .graphManager;

      const getNodeGroups = () => graphManager.getStencilNodeGroups();
      const startDrag = (nodeType: string, event: MouseEvent) => {
        graphManager.startNodeDrag(nodeType, event);
      };

      const addPanel = () => {
        ctx.skeleton.sidebar.add({
          key: "stencil-panel",
          area: "sidebar",
          content: StencilContainer,
          contentProps: {
            getNodeGroups,
            startDrag,
          },
        });
      };

      if (ctx.editor.getGraph()) {
        addPanel();
      } else {
        unsubGraphReady = signal.onceSignal("graph:ready", () => {
          addPanel();
        });
      }
    },
    destroy() {
      unsubGraphReady?.();
      unsubGraphReady = null;
      ctx.skeleton.sidebar.remove("stencil-panel");
    },
  };
}
