import { describe, it, expect, vi } from 'vitest';
import { PluginManager } from '../src/plugins/plugin-manager';
import { Editor } from '../src/editor';
import type { IPluginContext, IPluginConfig } from '../src/plugins/types';

function createEditor(): Editor {
  const editor = new Editor();
  editor.setSkeleton({
    header: {} as any,
    sidebar: {} as any,
    inspector: {} as any,
    canvasToolbar: {} as any,
    canvas: {} as any,
    add() {},
    remove() {},
  });
  return editor;
}

function pluginCreator(name: string, dep: string[] = [], initFn?: () => void) {
  return (ctx: IPluginContext): IPluginConfig => ({
    name,
    dep,
    init: initFn,
  });
}

describe('PluginManager', () => {
  it('register adds a plugin', async () => {
    const pm = new PluginManager(createEditor());
    await pm.register(pluginCreator('a'));
    expect(pm.has('a')).toBe(true);
    expect(pm.size).toBe(1);
  });

  it('get returns registered plugin', async () => {
    const pm = new PluginManager(createEditor());
    await pm.register(pluginCreator('b'));
    const p = pm.get('b');
    expect(p).toBeDefined();
    expect(p!.name).toBe('b');
  });

  it('getAll returns all plugins', async () => {
    const pm = new PluginManager(createEditor());
    await pm.register(pluginCreator('c'));
    await pm.register(pluginCreator('d'));
    expect(pm.getAll()).toHaveLength(2);
  });

  it('init calls plugin init in topological order', async () => {
    const order: string[] = [];
    const pm = new PluginManager(createEditor());
    await pm.register(pluginCreator('y', ['x'], () => { order.push('y'); }));
    await pm.register(pluginCreator('x', [], () => { order.push('x'); }));
    await pm.init();
    expect(order).toEqual(['x', 'y']);
  });

  it('init throws on missing dependency', async () => {
    const pm = new PluginManager(createEditor());
    await pm.register(pluginCreator('z', ['missing']));
    await expect(pm.init()).rejects.toThrow('plugin dependency missing');
  });

  it('stops initialization and destroys initialized plugins when a plugin fails', async () => {
    const destroyFirst = vi.fn();
    const initializeLater = vi.fn();
    const pm = new PluginManager(createEditor());
    await pm.register(() => ({
      name: 'first',
      init() {},
      destroy: destroyFirst,
    }));
    const cleanupBroken = vi.fn();
    await pm.register(() => ({
      name: 'broken',
      init() {
        throw new Error('initialization failed');
      },
      destroy: cleanupBroken,
    }));
    await pm.register(pluginCreator('later', [], initializeLater));

    await expect(pm.init()).rejects.toThrow('initialization failed');
    expect(destroyFirst).toHaveBeenCalledOnce();
    expect(cleanupBroken).toHaveBeenCalledOnce();
    expect(initializeLater).not.toHaveBeenCalled();
    expect(pm.get('first')?.isInited()).toBe(false);
  });

  it('delete removes and destroys plugin', async () => {
    const destroyFn = vi.fn();
    const pm = new PluginManager(createEditor());
    await pm.register((ctx: IPluginContext) => ({
      name: 'del',
      init() {},
      destroy: destroyFn,
    }));
    await pm.init();
    const result = await pm.delete('del');
    expect(result).toBe(true);
    expect(pm.has('del')).toBe(false);
    expect(destroyFn).toHaveBeenCalled();
  });

  it('delete returns false for non-existent', async () => {
    const pm = new PluginManager(createEditor());
    const result = await pm.delete('nope');
    expect(result).toBe(false);
  });

  it('removes a plugin from the registry even when its destroy hook fails', async () => {
    const pm = new PluginManager(createEditor());
    await pm.register(() => ({
      name: 'broken-destroy',
      init() {},
      destroy() {
        throw new Error('destroy failed');
      },
    }));
    await pm.init();

    await expect(pm.delete('broken-destroy')).rejects.toThrow('destroy failed');
    expect(pm.has('broken-destroy')).toBe(false);
  });

  it('setDisabled marks plugin disabled', async () => {
    const pm = new PluginManager(createEditor());
    await pm.register(pluginCreator('dis'));
    await pm.init();
    pm.setDisabled('dis', true);
    expect(pm.get('dis')!.disabled).toBe(true);
  });

  it('dispose clears all plugins', async () => {
    const pm = new PluginManager(createEditor());
    await pm.register(pluginCreator('e'));
    await pm.init();
    await pm.dispose();
    expect(pm.size).toBe(0);
    expect(pm.getAll()).toHaveLength(0);
  });

  it('register replaces existing plugin with same name', async () => {
    const pm = new PluginManager(createEditor());
    const destroy = vi.fn();
    await pm.register(() => ({ name: 'dup', init() {}, destroy }));
    await pm.init();
    await pm.register(pluginCreator('dup'));
    expect(pm.getAll()).toHaveLength(1);
    expect(pm.size).toBe(1);
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('returns a copy of the registered plugin list', async () => {
    const pm = new PluginManager(createEditor());
    await pm.register(pluginCreator('kept'));
    pm.getAll().splice(0, 1);
    expect(pm.has('kept')).toBe(true);
    expect(pm.getAll()).toHaveLength(1);
  });
});
