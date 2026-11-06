import { getSkeleton } from "@flow-designer/skeleton";
import type { IPluginConfig, IPluginContext } from "@flow-designer/core";
import { GraphManager } from "@flow-designer/graph";
import { prototypeRegistry, signal } from "@flow-designer/model";
import { t } from "@flow-designer/i18n";
import type { NodeMeta, GraphOptions, Prototype } from "@flow-designer/model";
import { GraphBridge } from "./bridge/graph-bridge";
import { registerCanvasCommands } from "./commands";

function toNodeMeta(prototype: Prototype): NodeMeta {
  return {
    name: prototype.getName(),
    typeName: prototype.getTypeName(),
    icon: prototype.getIcon() || undefined,
    category: prototype.getCategory() || undefined,
    categoryTitle: prototype.getCategoryTitle() || undefined,
  };
}

function showInitError(container: HTMLElement): void {
  const message = document.createElement("div");
  message.style.padding = "16px";
  message.style.color = "#f5222d";
  message.style.fontSize = "14px";
  message.textContent = t("plugin.graph.initFailed");
  container.appendChild(message);
}

export function pluginX6Graph(ctx: IPluginContext, options: GraphOptions = {}): IPluginConfig {
  const skeleton = getSkeleton(ctx.editor);
  const graphManager = new GraphManager();
  let graphBridge: GraphBridge | null = null;
  let destroyed = false;
  let releaseCommands: (() => void) | null = null;
  let unsubscribeRegistry: (() => void) | null = null;
  let unregisterMount: (() => void) | undefined;
  let cleanupMount: (() => void) | null = null;

  function registerAllPrototypes(): void {
    prototypeRegistry.getRegistry().forEach((prototype) => {
      graphManager.registerNodeType(toNodeMeta(prototype), prototype.getView());
    });
  }

  return {
    name: "plugin-x6-graph",
    dep: [],
    init() {
      releaseCommands = registerCanvasCommands();
      try {
        unregisterMount = skeleton.canvas.hooks.didMount((container) => {
          if (destroyed) return;
          cleanupMount?.();
          const doc = ctx.editor.getDocument();
          let ownedContainer: HTMLElement | null = null;
          let errorMessage: HTMLElement | null = null;
          let cleaned = false;
          const onRoutingFailure = (payload: unknown) => {
            ctx.logger.warn("No obstacle-free route within the routing budget:", payload);
          };
          const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            unsubscribeRegistry?.();
            unsubscribeRegistry = null;
            graphBridge?.teardown();
            graphBridge = null;
            doc
              .getTimeline()
              .setApplier((data: Parameters<typeof doc.applyTimelinePointData>[0]) => {
                doc.applyTimelinePointData(data);
              });
            graphManager.off("edge:routing:failed", onRoutingFailure);
            graphManager.dispose();
            ctx.editor.setGraph(null);
            if (ownedContainer && ctx.editor.getContainer() === ownedContainer)
              ctx.editor.setContainer(null);
            errorMessage?.remove();
            if (cleanupMount === cleanup) cleanupMount = null;
          };
          cleanupMount = cleanup;
          try {
            graphManager.init(container, options);
            graphManager.on("edge:routing:failed", onRoutingFailure);
            if (!ctx.editor.getContainer()) {
              ownedContainer =
                container.closest<HTMLElement>('[data-fd-area="workbench"]') ?? container;
              ctx.editor.setContainer(ownedContainer);
            }
            ctx.editor.setGraph(graphManager);
            registerAllPrototypes();
            unsubscribeRegistry = prototypeRegistry.onRegistryChange(registerAllPrototypes);

            graphBridge = new GraphBridge(graphManager, doc, (error) =>
              ctx.logger.error("Graph mutation failed:", error),
            );
            graphBridge.setup();
            doc
              .getTimeline()
              .setApplier((data: Parameters<typeof doc.applyTimelinePointData>[0]) => {
                if (graphBridge) graphBridge.resetFromData(data);
                else doc.applyTimelinePointData(data);
              });

            signal.sendSignal("graph:ready", graphManager);
          } catch (error) {
            cleanup();
            signal.sendSignal("graph:init-failed", error);
            showInitError(container);
            errorMessage = container.lastElementChild as HTMLElement | null;
            return () => errorMessage?.remove();
          }
          return cleanup;
        });
      } catch (error) {
        releaseCommands?.();
        releaseCommands = null;
        signal.sendSignal("graph:init-failed", error);
      }
    },
    destroy() {
      destroyed = true;
      releaseCommands?.();
      releaseCommands = null;
      unregisterMount?.();
      unregisterMount = undefined;
      cleanupMount?.();
    },
    exports() {
      return { graphManager };
    },
  };
}
