import type { IPluginConfig, IPluginContext } from '@flow-designer/core';

export function pluginUnsavedPrompt(ctx: IPluginContext): IPluginConfig {
  let handler: ((e: BeforeUnloadEvent) => void) | null = null;

  return {
    name: 'plugin-unsaved-prompt',
    dep: [],
    init() {
      handler = (e: BeforeUnloadEvent) => {
        const timeline = ctx.editor.getDocument().getTimeline();
        if (timeline.isModified()) {
          e.preventDefault();
        }
      };
      window.addEventListener('beforeunload', handler);
    },
    destroy() {
      if (handler) {
        window.removeEventListener('beforeunload', handler);
        handler = null;
      }
    },
  };
}
