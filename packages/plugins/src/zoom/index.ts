import { getSkeleton } from "@flow-designer/skeleton";
import type { IPluginConfig, IPluginContext } from "@flow-designer/core";
import { commandRegistry } from "@flow-designer/core";
import { utils } from "@flow-designer/model";
import { ZoomControl } from "./zoom-control";

const ZOOM_STEP = 0.1;

export function pluginZoom(ctx: IPluginContext): IPluginConfig {
  const skeleton = getSkeleton(ctx.editor);
  const shortcutDisposers: Array<() => void> = [];
  function zoomIn() {
    const graph = ctx.graph;
    if (graph) graph.zoomTo(graph.getZoom() + ZOOM_STEP);
  }

  function zoomOut() {
    const graph = ctx.graph;
    if (graph) graph.zoomTo(graph.getZoom() - ZOOM_STEP);
  }

  function resetZoom() {
    const graph = ctx.graph;
    if (graph) {
      graph.zoomToFit();
    }
  }

  return {
    name: "plugin-zoom",
    dep: ["plugin-x6-graph"],
    init() {
      commandRegistry.register("zoomIn", zoomIn);
      commandRegistry.register("zoomOut", zoomOut);
      commandRegistry.register("resetZoom", resetZoom);

      shortcutDisposers.push(
        utils.hotkey.bindScoped(
          "mod+=",
          (e) => {
            e.preventDefault();
            zoomIn();
          },
          () => ctx.container,
        ),
      );
      shortcutDisposers.push(
        utils.hotkey.bindScoped(
          "mod+-",
          (e) => {
            e.preventDefault();
            zoomOut();
          },
          () => ctx.container,
        ),
      );

      skeleton.canvasToolbar.add({
        key: "zoom-control",
        area: "canvasToolbar",
        content: ZoomControl,
        contentProps: {
          getZoom: () => ctx.graph?.getZoom() ?? 1,
          onZoomIn: zoomIn,
          onZoomOut: zoomOut,
          onZoomTo: (factor: number) => {
            ctx.graph?.zoomTo(factor);
          },
          onResetZoom: resetZoom,
          subscribe: (cb: () => void) => {
            const handler = () => {
              cb();
            };
            const graph = ctx.graph;
            graph?.on("scale", handler);
            return () => {
              graph?.off("scale", handler);
            };
          },
        },
      });
    },
    destroy() {
      shortcutDisposers.splice(0).forEach((dispose) => {
        dispose();
      });
      commandRegistry.unregister("zoomIn");
      commandRegistry.unregister("zoomOut");
      commandRegistry.unregister("resetZoom");
      skeleton.canvasToolbar.remove("zoom-control");
    },
  };
}
