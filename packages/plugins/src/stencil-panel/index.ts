import { getSkeleton } from "@flow-designer/skeleton";
import type { IPluginConfig, IPluginContext } from "@flow-designer/core";
import { getGraphAdapter } from "../x6-graph/adapter";
import { StencilContainer } from "./stencil-container";

export function pluginStencilPanel(ctx: IPluginContext): IPluginConfig {
  const skeleton = getSkeleton(ctx.editor);
  let unsubGraphReady: (() => void) | null = null;

  return {
    name: "plugin-stencil-panel",
    dep: ["plugin-x6-graph"],
    init() {
      const graphManager = getGraphAdapter(ctx.plugins);
      if (!graphManager) throw new Error("The graph plugin must be registered before the stencil");

      const getNodeGroups = () => graphManager.getStencilNodeGroups();
      const startDrag = (nodeType: string, event: MouseEvent) => {
        graphManager.startNodeDrag(nodeType, event);
      };

      const addPanel = () => {
        skeleton.sidebar.add({
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
        unsubGraphReady = ctx.editor.events.onceSignal("graph:ready", () => {
          addPanel();
        });
      }
    },
    destroy() {
      unsubGraphReady?.();
      unsubGraphReady = null;
      skeleton.sidebar.remove("stencil-panel");
    },
  };
}
