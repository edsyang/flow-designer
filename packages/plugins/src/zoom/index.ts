import { getSkeleton } from "@flow-designer/skeleton";
import type { IPluginConfig, IPluginContext } from "@flow-designer/core";
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
      shortcutDisposers.push(ctx.commands.register("zoomIn", zoomIn));
      shortcutDisposers.push(ctx.commands.register("zoomOut", zoomOut));
      shortcutDisposers.push(ctx.commands.register("resetZoom", resetZoom));

      shortcutDisposers.push(
        ctx.shortcuts.bind("mod+=", (e) => {
          e.preventDefault();
          zoomIn();
        }),
      );
      shortcutDisposers.push(
        ctx.shortcuts.bind("mod+-", (e) => {
          e.preventDefault();
          zoomOut();
        }),
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
            return (
              ctx.graph?.subscribeEvents((event) => {
                if (event.type === "zoom-changed") cb();
              }) ?? (() => {})
            );
          },
        },
      });
    },
    destroy() {
      shortcutDisposers.splice(0).forEach((dispose) => {
        dispose();
      });
      skeleton.canvasToolbar.remove("zoom-control");
    },
  };
}
