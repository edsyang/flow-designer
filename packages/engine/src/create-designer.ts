import { configure } from 'mobx';
import { getLogger } from '@flow-designer/core';
import { Document, setterRegistry, contentTypesRegistry, utils } from '@flow-designer/model';
import { registerBuiltinPlugins, pluginAutoSave, pluginUnsavedPrompt } from '@flow-designer/plugins';
import { registerBuiltinSetters } from '@flow-designer/setters';
import { Engine } from './engine';
import type { DesignerOptions, Designer } from './types';

const logger = getLogger({ level: 'error', bizName: 'engine:createDesigner' });

export async function createDesigner(options: DesignerOptions): Promise<Designer> {
  configure({ enforceActions: 'observed' });

  const engine = new Engine();
  const { editor, plugins } = engine;

  try {
    editor.setContainer(options.container ?? null);
    engine.addDisposer(utils.hotkey.init(window));
    for (const transformer of options.transformers ?? []) {
      engine.addDisposer(contentTypesRegistry.registerTransformer(transformer));
    }

    if (!options.disableBuiltinSetters) {
      registerBuiltinSetters(setterRegistry);
    }

    await registerBuiltinPlugins(
      plugins.toProxy(),
      options.disableBuiltinPlugins,
      options.graphOptions,
    );

    if (options.plugins) {
      for (const plugin of options.plugins) {
        await plugins.register(plugin);
      }
    }

    if (options.autoSave) {
      const autoSaveOptions = typeof options.autoSave === 'object' ? options.autoSave : undefined;
      await plugins.register(pluginAutoSave, autoSaveOptions);
    }

    if (options.unsavedPrompt) {
      await plugins.register(pluginUnsavedPrompt);
    }

    const doc = new Document({
      id: 'main',
      documentType: options.documentType,
      documentVersion: options.documentVersion,
    }, options.docSettings);
    editor.setDocument(doc);

    await plugins.init();

    return {
      engine,
      editor,
      document: doc,
      get graph() { return editor.getGraph(); },
      plugins: plugins.toProxy(),
      destroy: () => engine.destroy(),
    };
  } catch (error) {
    try {
      await engine.destroy();
    } catch (cleanupError) {
      logger.error('Failed to clean up after designer creation error:', cleanupError);
    }
    throw error;
  }
}
