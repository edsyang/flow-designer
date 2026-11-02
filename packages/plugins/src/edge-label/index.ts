import type { IPluginConfig, IPluginContext } from '@flow-designer/core';
import { signal } from '@flow-designer/model';
import type { ContentNode, GenericRelation, GraphEventHandler, IGraphManager } from '@flow-designer/model';

export function pluginEdgeLabel(ctx: IPluginContext): IPluginConfig {
  let graph: IGraphManager | null = null;
  let unsubscribe: (() => void) | null = null;
  let input: HTMLInputElement | null = null;
  const handler: GraphEventHandler = (...args) => {
    const payload = args[0] as { edge?: { id: string }; e?: MouseEvent } | undefined;
    if (!payload?.edge || !payload.e) return;
    const nodes = ctx.editor.getDocument().getContent().getNodes() as Array<ContentNode<GenericRelation>>;
    const relation = nodes.map(node => node.getRelation()).find(item => item.getEdgeById(payload.edge!.id));
    const edge = relation?.getEdgeById(payload.edge.id);
    if (!relation || !edge) return;
    input?.remove();
    const current = typeof edge.props?.label === 'string' ? edge.props.label : '';
    const field = document.createElement('input');
    input = field;
    field.value = current;
    Object.assign(field.style, { position: 'fixed', left: `${payload.e.clientX - 40}px`, top: `${payload.e.clientY - 14}px`, width: '80px', height: '28px', zIndex: '1000' });
    const graphContainer = (graph?.getX6Graph() as { container?: HTMLElement } | undefined)?.container;
    (graphContainer ?? document.body).appendChild(field);
    field.focus(); field.select();
    field.addEventListener('blur', () => {
      if (field.value.trim() !== current) relation.updateEdgeProps(edge.id, { label: field.value.trim() });
      field.remove(); if (input === field) input = null;
    }, { once: true });
    field.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); field.blur(); }
      if (event.key === 'Escape') { field.value = current; field.blur(); }
    });
  };
  const bind = () => { graph?.off('edge:dblclick', handler); graph = ctx.graph; graph?.on('edge:dblclick', handler); };
  return {
    name: 'plugin-edge-label', dep: ['plugin-x6-graph'],
    init() { if (ctx.graph) bind(); unsubscribe = signal.onSignal('graph:ready', (ready) => { if (ready === ctx.graph) bind(); }); },
    destroy() { unsubscribe?.(); graph?.off('edge:dblclick', handler); input?.remove(); graph = null; input = null; },
  };
}
