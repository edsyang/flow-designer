import type { Cell, Graph } from '@antv/x6';
import type { Scroller } from '@antv/x6-plugin-scroller';

/** Presentation-only visibility; document data and existing caller-hidden cells are untouched. */
export function installViewportCulling(graph: Graph, scroller: Scroller): () => void {
  const hidden = new Map<string, { element: SVGElement; previous: string }>();
  const uncull = (id: string) => {
    const entry = hidden.get(id);
    if (entry) { entry.element.style.visibility = entry.previous; hidden.delete(id); }
  };
  const dirtyEdges = new Set<string>();
  const edgeBounds = new Map<string, { x: number; y: number; width: number; height: number }>();
  let frame = 0;
  let settleFrame = 0;
  let dragging: string | null = null;
  let cullingEnabled = false;
  const refreshGeometry = (ids: string[]) => {
    if (!cullingEnabled) return;
    const rect = scroller.container.getBoundingClientRect();
    const a = graph.clientToLocal(rect.left - 300, rect.top - 300);
    const b = graph.clientToLocal(rect.right + 300, rect.bottom + 300);
    const selected = new Set(graph.getSelectedCells().map(cell => cell.id));
    for (const id of ids) {
      const edge = graph.getCellById(id) as Cell | null;
      if (!edge?.isEdge() || !edge.isVisible() || selected.has(id) || edge.getSourceCellId() === dragging || edge.getTargetCellId() === dragging) { uncull(id); continue; }
      const view = graph.findViewByCell(edge);
      const path = view?.container.querySelector<SVGGraphicsElement>('path[d]');
      try {
        const box = path?.getBBox();
        if (!box || (!box.width && !box.height)) { uncull(id); continue; }
        edgeBounds.set(id, { x: box.x, y: box.y, width: box.width, height: box.height });
        const visible = box.x + box.width >= a.x && box.x <= b.x && box.y + box.height >= a.y && box.y <= b.y;
        if (visible) uncull(id);
        else if (!hidden.has(id) && view?.container instanceof SVGElement) {
          hidden.set(id, { element: view.container, previous: view.container.style.visibility });
          view.container.style.visibility = 'hidden';
        }
      } catch { uncull(id); }
    }
  };
  const refresh = () => {
    frame = 0;
    const nodes = graph.getNodes();
    const selected = new Set(graph.getSelectedCells().map(cell => cell.id));
    const rect = scroller.container.getBoundingClientRect();
    const a = graph.clientToLocal(rect.left - 300, rect.top - 300);
    const b = graph.clientToLocal(rect.right + 300, rect.bottom + 300);
    const intersects = (box: { x: number; y: number; width: number; height: number }) =>
      box.x + box.width >= a.x && box.x <= b.x && box.y + box.height >= a.y && box.y <= b.y;
    const setVisible = (cell: Cell, visible: boolean) => {
      if (visible || !cell.isVisible()) { uncull(cell.id); return; }
      if (hidden.has(cell.id)) return;
      const view = graph.findViewByCell(cell);
      if (!view) return;
      const element = view.container;
      if (!(element instanceof SVGElement)) return;
      hidden.set(cell.id, { element, previous: element.style.visibility });
      element.style.visibility = 'hidden';
    };
    const enabled = nodes.length >= 300 && rect.width > 0 && rect.height > 0;
    cullingEnabled = enabled;
    for (const node of nodes) setVisible(node, !enabled || selected.has(node.id) || dragging === node.id || intersects(node.getBBox()));
    for (const edge of graph.getEdges()) {
      if (!enabled || selected.has(edge.id) || edge.getSourceCellId() === dragging || edge.getTargetCellId() === dragging) { setVisible(edge, true); continue; }
      if (dirtyEdges.has(edge.id)) { setVisible(edge, true); continue; }
      let box = edgeBounds.get(edge.id);
      if (!box && !hidden.has(edge.id)) {
        const view = graph.findViewByCell(edge);
        const path = view?.container.querySelector<SVGGraphicsElement>('path[d]');
        try {
          const measured = path?.getBBox();
          if (measured && (measured.width || measured.height)) {
            box = { x: measured.x, y: measured.y, width: measured.width, height: measured.height };
            edgeBounds.set(edge.id, box);
          }
        } catch { /* Unmeasurable paths stay visible. */ }
      }
      setVisible(edge, !box || intersects(box));
    }
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(refresh); };
  const markDirty = (id: string) => {
    edgeBounds.delete(id); dirtyEdges.add(id); uncull(id);
    if (!settleFrame) settleFrame = requestAnimationFrame(() => {
      settleFrame = requestAnimationFrame(() => { settleFrame = 0; const ids = [...dirtyEdges]; dirtyEdges.clear(); refreshGeometry(ids); });
    });
  };
  const invalidate = ({ cell }: { cell: Cell }) => {
    if (cell.isEdge()) {
      if (dragging && (cell.getSourceCellId() === dragging || cell.getTargetCellId() === dragging)) { edgeBounds.delete(cell.id); uncull(cell.id); return; }
      markDirty(cell.id);
    }
    schedule();
  };
  const invalidateNode = ({ node }: { node: Cell }) => {
    if (dragging === node.id) return;
    for (const edge of graph.getConnectedEdges(node)) {
      markDirty(edge.id);
    }
    schedule();
  };
  const geometryChanged = ({ edge }: { edge: Cell }) => { markDirty(edge.id); };
  const moveStart = ({ node }: { node: Cell }) => {
    if (dragging === node.id) return;
    dragging = node.id; uncull(node.id);
    for (const edge of graph.getConnectedEdges(node)) { edgeBounds.delete(edge.id); uncull(edge.id); }
  };
  const moveEnd = ({ node, cell }: { node?: Cell; cell?: Cell }) => { dragging = null; const moved = node ?? cell; if (moved) invalidateNode({ node: moved }); else schedule(); };
  const abortDrag = () => { if (dragging) moveEnd({ cell: graph.getCellById(dragging) }); };
  const remove = ({ cell }: { cell: Cell }) => { uncull(cell.id); edgeBounds.delete(cell.id); dirtyEdges.delete(cell.id); schedule(); };
  const add = ({ cell }: { cell: Cell }) => { if (cell.isEdge()) markDirty(cell.id); schedule(); };
  const rendered = () => { if (!dragging) schedule(); };
  scroller.container.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('blur', abortDrag); document.addEventListener('pointercancel', abortDrag);
  graph.on('scale', schedule); graph.on('translate', schedule); graph.on('resize', schedule);
  graph.on('cell:added', add); graph.on('cell:removed', remove); graph.on('render:done', rendered);
  graph.on('selection:changed', schedule); graph.on('edge:change:vertices', invalidate);
  graph.on('edge:change:source', invalidate); graph.on('edge:change:target', invalidate);
  graph.on('edge:change:router', invalidate); graph.on('edge:change:connector', invalidate);
  graph.on('edge:geometry:changed', geometryChanged);
  graph.on('node:change:position', invalidateNode); graph.on('node:change:size', invalidateNode);
  graph.on('node:moving', moveStart); graph.on('node:moved', moveEnd);
  schedule();
  return () => {
    if (frame) cancelAnimationFrame(frame);
    if (settleFrame) cancelAnimationFrame(settleFrame);
    scroller.container.removeEventListener('scroll', schedule);
    window.removeEventListener('blur', abortDrag); document.removeEventListener('pointercancel', abortDrag);
    graph.off('scale', schedule); graph.off('translate', schedule); graph.off('resize', schedule);
    graph.off('cell:added', add); graph.off('cell:removed', remove); graph.off('render:done', rendered);
    graph.off('selection:changed', schedule); graph.off('edge:change:vertices', invalidate);
    graph.off('edge:change:source', invalidate); graph.off('edge:change:target', invalidate);
    graph.off('edge:change:router', invalidate); graph.off('edge:change:connector', invalidate);
    graph.off('edge:geometry:changed', geometryChanged);
    graph.off('node:change:position', invalidateNode); graph.off('node:change:size', invalidateNode);
    graph.off('node:moving', moveStart); graph.off('node:moved', moveEnd);
    for (const id of hidden.keys()) uncull(id);
    hidden.clear(); edgeBounds.clear(); dirtyEdges.clear();
  };
}
