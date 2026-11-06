import type { Edge, EdgeView, Graph } from "@antv/x6";
interface OwnedMarker {
  node: SVGMarkerElement;
  line: Element;
  original: string;
  url: string;
}
const queues = new WeakMap<Graph, (view: EdgeView) => void>();
let serial = 0;
/** Default-marker compression is presentation only; custom marker definitions remain untouched. */
export function installAdaptiveTargetMarkers(graph: Graph): () => void {
  const owned = new Map<string, OwnedMarker>(),
    pending = new Set<EdgeView>();
  let frame: number | null = null;
  const restore = (id: string) => {
    const state = owned.get(id);
    if (!state) return;
    if (state.line.getAttribute("marker-end") === state.url)
      state.line.setAttribute("marker-end", state.original);
    state.node.remove();
    owned.delete(id);
  };
  const update = (view: EdgeView) => {
    const connector: unknown = view.cell.getConnector();
    const args: unknown =
      connector && typeof connector === "object" ? Reflect.get(connector, "args") : null;
    const expected: unknown =
      args && typeof args === "object" ? Reflect.get(args, "adaptiveTargetMarkerSize") : null;
    const marker: unknown = view.cell.attr("line/targetMarker");
    if (
      typeof expected !== "number" ||
      !marker ||
      typeof marker !== "object" ||
      Object.keys(marker).length !== 2 ||
      Reflect.get(marker, "name") !== "block" ||
      Reflect.get(marker, "size") !== expected
    ) {
      restore(view.cell.id);
      return;
    }
    const line = view.findOne("line");
    if (!line) return;
    const points = [view.sourceAnchor, ...view.routePoints, view.targetAnchor];
    const previous = points[points.length - 2];
    if (!previous) return;
    const leg =
      Math.abs(view.targetAnchor.x - previous.x) + Math.abs(view.targetAnchor.y - previous.y);
    const size = Math.min(expected, Math.max(1, leg / 3));
    if (size >= expected - 0.01) {
      restore(view.cell.id);
      return;
    }
    const existing = owned.get(view.cell.id);
    const current = line.getAttribute("marker-end");
    const original = current === existing?.url ? existing.original : current;
    const id = original?.match(/#([^)]*)/u)?.[1];
    const svg = line.closest("svg");
    const source = id ? svg?.getElementById(id) : null;
    if (!source || !original) return;
    restore(view.cell.id);
    const clone = source.cloneNode(false) as SVGMarkerElement;
    clone.id = `fd-adaptive-marker-${String(++serial)}`;
    clone.setAttribute("data-original-marker", id ?? "");
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("transform", `scale(${String(size / expected)})`);
    for (const child of source.childNodes) group.append(child.cloneNode(true));
    clone.append(group);
    source.parentNode?.append(clone);
    const url = `url(#${clone.id})`;
    line.setAttribute("marker-end", url);
    clone.setAttribute("data-adaptive-size", String(size));
    owned.set(view.cell.id, { node: clone, line, original, url });
  };
  const queue = (view: EdgeView) => {
    pending.add(view);
    if (frame === null)
      frame = requestAnimationFrame(() => {
        frame = null;
        const views = [...pending];
        pending.clear();
        for (const item of views) update(item);
      });
  };
  queues.set(graph, queue);
  const changed = ({ edge }: { edge: Edge }) => {
    const view = graph.findViewByCell(edge);
    if (view?.isEdgeView()) queue(view);
  };
  const removed = ({ edge }: { edge: Edge }) => {
    restore(edge.id);
    for (const view of pending) if (view.cell.id === edge.id) pending.delete(view);
  };
  graph.on("edge:change:attrs", changed);
  graph.on("edge:removed", removed);
  return () => {
    if (frame !== null) cancelAnimationFrame(frame);
    queues.delete(graph);
    pending.clear();
    for (const id of owned.keys()) restore(id);
    graph.off("edge:change:attrs", changed);
    graph.off("edge:removed", removed);
  };
}
export function queueAdaptiveTargetMarker(view: EdgeView): void {
  queues.get(view.graph)?.(view);
}
