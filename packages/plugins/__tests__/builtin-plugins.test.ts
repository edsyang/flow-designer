import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

vi.mock('antd', () => ({
  Button: 'button',
  Space: 'div',
}));
vi.mock('@flow-designer/react', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    getMessageApi: () => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn() }),
  };
});
vi.mock('@ant-design/icons', () => ({
  MinusOutlined: 'span',
  PlusOutlined: 'span',
  ZoomInOutlined: 'span',
  ZoomOutOutlined: 'span',
  ExpandOutlined: 'span',
  UndoOutlined: 'span',
  RedoOutlined: 'span',
}));

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
});
import { commandRegistry } from '@flow-designer/core';

function createMockContext(overrides: Record<string, any> = {}) {
  return {
    graph: {
      getZoom: vi.fn(() => 1),
      zoomTo: vi.fn(),
      centerContent: vi.fn(),
      zoomToFit: vi.fn(),
      getSelection: vi.fn(() => []),
      removeCell: vi.fn(),
      getX6Graph: vi.fn(() => ({
        getSelectedCells: vi.fn(() => []),
        copy: vi.fn(),
        paste: vi.fn(),
      })),
      on: vi.fn(),
      off: vi.fn(),
    },
    skeleton: {
      header: { add: vi.fn(), remove: vi.fn() },
      canvasToolbar: { add: vi.fn(), remove: vi.fn() },
      sidebar: { add: vi.fn(), remove: vi.fn() },
      inspector: { add: vi.fn(), remove: vi.fn() },
      canvas: { add: vi.fn(), remove: vi.fn() },
    },
    editor: {
      getDocument: vi.fn(() => ({
        getTimeline: vi.fn(() => ({
          back: vi.fn(),
          forward: vi.fn(),
          onStateChange: vi.fn(() => vi.fn()),
          getState: vi.fn(() => 7),
          isModified: vi.fn(() => false),
        })),
        getContent: vi.fn(() => ({
          getNode: vi.fn(),
          removeNode: vi.fn(),
          serialize: vi.fn(() => ({})),
        })),
      })),
    },
    plugins: {},
    container: document.createElement('div'),
    options: {},
    logger: {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
    },
    ...overrides,
  };
}

describe('pluginZoom', () => {
  beforeEach(() => {
    commandRegistry.unregister('zoomIn');
    commandRegistry.unregister('zoomOut');
    commandRegistry.unregister('resetZoom');
  });

  it('registers commands and canvas toolbar component', async () => {
    const { pluginZoom } = await import('../src/zoom');
    const ctx = createMockContext();
    const config = pluginZoom(ctx as any);
    expect(config.name).toBe('plugin-zoom');
    expect(config.dep).toEqual(['plugin-x6-graph']);

    config.init!();
    expect(commandRegistry.hasCommand('zoomIn')).toBe(true);
    expect(commandRegistry.hasCommand('zoomOut')).toBe(true);
    expect(commandRegistry.hasCommand('resetZoom')).toBe(true);
    expect(ctx.skeleton.canvasToolbar.add).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'zoom-control', area: 'canvasToolbar' }),
    );
  }, 30000);

  it('zoomIn increments zoom by 0.1', async () => {
    const { pluginZoom } = await import('../src/zoom');
    const ctx = createMockContext();
    const config = pluginZoom(ctx as any);
    config.init!();

    commandRegistry.executeCommand('zoomIn');
    expect(ctx.graph.zoomTo).toHaveBeenCalledWith(1.1);
  });

  it('resetZoom fits all canvas content', async () => {
    const { pluginZoom } = await import('../src/zoom');
    const ctx = createMockContext();
    const config = pluginZoom(ctx as any);
    config.init!();

    commandRegistry.executeCommand('resetZoom');
    expect(ctx.graph.zoomToFit).toHaveBeenCalled();
  });

  it('destroy unregisters commands and removes from canvas toolbar', async () => {
    const { pluginZoom } = await import('../src/zoom');
    const ctx = createMockContext();
    const config = pluginZoom(ctx as any);
    config.init!();
    config.destroy!();

    expect(commandRegistry.hasCommand('zoomIn')).toBe(false);
    expect(ctx.skeleton.canvasToolbar.remove).toHaveBeenCalledWith('zoom-control');
  });
});

describe('pluginUndoRedo', () => {
  beforeEach(() => {
    commandRegistry.unregister('undo');
    commandRegistry.unregister('redo');
  });

  it('registers undo and redo commands', async () => {
    const { pluginUndoRedo } = await import('../src/undo-redo');
    const ctx = createMockContext();
    const config = pluginUndoRedo(ctx as any);
    config.init!();

    expect(commandRegistry.hasCommand('undo')).toBe(true);
    expect(commandRegistry.hasCommand('redo')).toBe(true);
    expect(ctx.skeleton.canvasToolbar.add).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'undo-redo' }),
    );
  });

  it('undo calls timeline.back()', async () => {
    const { pluginUndoRedo } = await import('../src/undo-redo');
    const back = vi.fn();
    const ctx = createMockContext({
      editor: {
        getDocument: () => ({
          getTimeline: () => ({ back, forward: vi.fn(), onStateChange: vi.fn(() => vi.fn()), getState: vi.fn(() => 7) }),
        }),
      },
    });
    const config = pluginUndoRedo(ctx as any);
    config.init!();
    commandRegistry.executeCommand('undo');
    expect(back).toHaveBeenCalled();
  });
});

describe('pluginCopyPaste', () => {
  beforeEach(() => {
    commandRegistry.unregister('copy');
    commandRegistry.unregister('paste');
  });

  it('registers copy and paste commands', async () => {
    const { pluginCopyPaste } = await import('../src/copy-paste');
    const ctx = createMockContext();
    const config = pluginCopyPaste(ctx as any);
    config.init!();

    expect(commandRegistry.hasCommand('copy')).toBe(true);
    expect(commandRegistry.hasCommand('paste')).toBe(true);
  });

  it('copy copies selected cells via X6', async () => {
    const { pluginCopyPaste } = await import('../src/copy-paste');
    const cells = [{ id: 'n1' }];
    const copyFn = vi.fn();
    const ctx = createMockContext({
      graph: {
        ...createMockContext().graph,
        getX6Graph: () => ({
          getSelectedCells: () => cells,
          copy: copyFn,
          paste: vi.fn(),
        }),
      },
    });
    const config = pluginCopyPaste(ctx as any);
    config.init!();
    commandRegistry.executeCommand('copy');
    expect(copyFn).toHaveBeenCalledWith(cells);
  });
});

describe('pluginDelete', () => {
  beforeEach(() => {
    commandRegistry.unregister('delete');
  });

  it('registers delete command', async () => {
    const { pluginDelete } = await import('../src/delete');
    const ctx = createMockContext();
    const config = pluginDelete(ctx as any);
    config.init!();
    expect(commandRegistry.hasCommand('delete')).toBe(true);
  });

  it('deletes selected nodes via content.removeNode', async () => {
    const { pluginDelete } = await import('../src/delete');
    const removeNode = vi.fn();
    const removeEdgeById = vi.fn();
    const getNode = vi.fn((id: string) => (id === 'n1' ? { id: 'n1' } : null));
    const mockRelation = {
      getEdgeById: (id: string) => id === 'e1' ? { id: 'e1' } : null,
      removeEdgeById,
    };
    const mockNodes = [{ getRelation: () => mockRelation }];
    const ctx = createMockContext({
      graph: {
        ...createMockContext().graph,
        getSelection: () => ['n1', 'e1'],
        removeCell: vi.fn(),
      },
      editor: {
        getDocument: () => ({
          transaction: async (_title: string, operation: () => Promise<void>) => operation(),
          getContent: () => ({ getNode, removeNode, getNodes: () => mockNodes }),
        }),
      },
    });
    const config = pluginDelete(ctx as any);
    config.init!();
    await commandRegistry.executeCommand('delete');
    expect(removeNode).toHaveBeenCalledWith('n1');
    expect(removeEdgeById).toHaveBeenCalledWith('e1');
  });
});

describe('pluginAutoSave', () => {
  it('sets up and clears interval for IndexedDB saving', async () => {
    vi.useFakeTimers();
    const { pluginAutoSave } = await import('../src/auto-save');
    const ctx = createMockContext();
    const config = pluginAutoSave(ctx as any, { interval: 1000 });

    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    config.init!();

    vi.advanceTimersByTime(1000);

    config.destroy!();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
    vi.useRealTimers();
  });
});

describe('pluginUnsavedPrompt', () => {
  it('adds and removes beforeunload listener', async () => {
    const { pluginUnsavedPrompt } = await import('../src/unsaved-prompt');
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const ctx = createMockContext();
    const config = pluginUnsavedPrompt(ctx as any);
    config.init!();
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    config.destroy!();
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

describe('pluginEdgeLabel', () => {
  it('listens to edge:dblclick events', async () => {
    const { pluginEdgeLabel } = await import('../src/edge-label');
    const ctx = createMockContext();
    const config = pluginEdgeLabel(ctx as any);
    config.init!();
    expect(ctx.graph.on).toHaveBeenCalledWith('edge:dblclick', expect.any(Function));
  });

  it('cleans up event listener on destroy', async () => {
    const { pluginEdgeLabel } = await import('../src/edge-label');
    const ctx = createMockContext();
    const config = pluginEdgeLabel(ctx as any);
    config.init!();
    config.destroy!();
    expect(ctx.graph.off).toHaveBeenCalledWith('edge:dblclick', expect.any(Function));
  });
});

describe('pluginStencilPanel', () => {
  it('adds stencil container to sidebar', async () => {
    const { pluginStencilPanel } = await import('../src/stencil-panel');
    const getStencilNodeGroups = vi.fn(() => []);
    const startNodeDrag = vi.fn();
    const ctx = createMockContext({
      plugins: { 'plugin-x6-graph': { graphManager: { getStencilNodeGroups, startNodeDrag } } },
      editor: {
        ...createMockContext().editor,
        getGraph: vi.fn(() => ({})),
      },
    });
    const config = pluginStencilPanel(ctx as any);
    config.init!();
    expect(ctx.skeleton.sidebar.add).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'stencil-panel', area: 'sidebar' }),
    );
  });
});

describe('registerBuiltinPlugins', () => {
  it('registers the ten builtin plugins', async () => {
    const { registerBuiltinPlugins } = await import('../src/register-builtin-plugins');
    const pluginManager = { register: vi.fn() };
    await registerBuiltinPlugins(pluginManager as any);
    expect(pluginManager.register).toHaveBeenCalledTimes(10);
  }, 30000);

  it('respects disableList', async () => {
    const { registerBuiltinPlugins } = await import('../src/register-builtin-plugins');
    const pluginManager = { register: vi.fn() };
    await registerBuiltinPlugins(pluginManager as any, ['plugin-zoom', 'plugin-delete']);
    expect(pluginManager.register).toHaveBeenCalledTimes(8);
  });
});
