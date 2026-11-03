import type { IPluginConfig, IPluginContext } from "@flow-designer/core";
import { commandRegistry } from "@flow-designer/core";
import { utils } from "@flow-designer/model";
import { UndoRedoButtons } from "./undo-redo-buttons";

export function pluginUndoRedo(ctx: IPluginContext): IPluginConfig {
  const shortcutDisposers: Array<() => void> = [];
  function getTimeline() {
    return ctx.editor.getDocument().getTimeline();
  }

  function undo() {
    getTimeline().back();
    ctx.graph?.centerContent();
  }

  function redo() {
    getTimeline().forward();
    ctx.graph?.centerContent();
  }

  return {
    name: "plugin-undo-redo",
    dep: ["plugin-x6-graph"],
    init() {
      commandRegistry.register("undo", undo);
      commandRegistry.register("redo", redo);

      shortcutDisposers.push(
        utils.hotkey.bindScoped(
          "mod+z",
          (e) => {
            e.preventDefault();
            undo();
          },
          () => ctx.container,
        ),
      );
      shortcutDisposers.push(
        utils.hotkey.bindScoped(
          "mod+shift+z",
          (e) => {
            e.preventDefault();
            redo();
          },
          () => ctx.container,
        ),
      );
      shortcutDisposers.push(
        utils.hotkey.bindScoped(
          "mod+y",
          (e) => {
            e.preventDefault();
            redo();
          },
          () => ctx.container,
        ),
      );

      ctx.skeleton.canvasToolbar.add({
        key: "undo-redo",
        area: "canvasToolbar",
        content: UndoRedoButtons,
        contentProps: { getTimeline },
      });
    },
    destroy() {
      shortcutDisposers.splice(0).forEach((dispose) => {
        dispose();
      });
      commandRegistry.unregister("undo");
      commandRegistry.unregister("redo");
      ctx.skeleton.canvasToolbar.remove("undo-redo");
    },
  };
}
