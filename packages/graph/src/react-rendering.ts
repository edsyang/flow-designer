import { runCleanupTasks } from "./cleanup-tasks";
import { Graph, Node as X6Node } from "@antv/x6";
import { register, shapeMaps } from "@antv/x6-react-shape";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ContentNode } from "@flow-designer/model";
import type { NodeMeta, NodeView } from "./contracts";
import type { EdgeTypeConfig } from "./contracts";
import { wrapWithErrorBoundary } from "./node-error-boundary";
import { translatePorts } from "./port-projection";

let nextRenderingOwner = 0;

/** Owns React roots and adapters; callbacks always read the current projection. */
export class GraphReactRendering {
  private readonly owner = ++nextRenderingOwner;
  private generation = 0;
  private nextShape = 0;
  private shapes = new Map<string, string>();
  private registrations = new Map<string, () => void>();
  resolveShape(publicShape: string): string {
    return this.shapes.get(publicShape) ?? publicShape;
  }
  begin(): void {
    this.releaseShapes();
    this.generation += 1;
    this.nextShape = 0;
  }
  private releaseShapes(): void {
    const cleanups = [...this.registrations.values()];
    this.registrations.clear();
    this.shapes.clear();
    runCleanupTasks(cleanups.reverse());
  }

  private roots = new Map<Element, { root: Root; release: () => void }>();
  constructor(
    private getNode: (id: string) => ContentNode | undefined,
    private isSelected: (id: string) => boolean,
    private getEdgeType: (id: string) => string | undefined,
    private getEdgeConfig: (type: string) => EdgeTypeConfig | undefined,
  ) {}
  registerNode(meta: NodeMeta, view: NodeView): void {
    if (!view.component) return;
    const Wrapped = wrapWithErrorBoundary(view.component, meta.name);
    const adapter = ({ node }: { node: X6Node; graph: Graph }) => {
      const { __modelVersion: _version, ...data } = node.getData<Record<string, unknown>>() ?? {};
      return createElement(Wrapped, {
        node: this.getNode(node.id) as ContentNode,
        selected: this.isSelected(node.id),
        data,
      });
    };
    const shape =
      this.shapes.get(meta.name) ??
      `fd-react-owner-${String(this.owner)}-${String(this.generation)}-${String(++this.nextShape)}`;
    const previous = this.registrations.get(shape);
    register({
      shape,
      width: view.defaultSize?.width ?? 180,
      height: view.defaultSize?.height ?? 40,
      component: adapter as any,
      ports: translatePorts(view.ports),
    });
    const content = shapeMaps[shape];
    const definition = X6Node.registry.get(shape);
    this.shapes.set(meta.name, shape);
    this.registrations.set(shape, () => {
      if (shapeMaps[shape] === content) Reflect.deleteProperty(shapeMaps, shape);
      if (X6Node.registry.get(shape) === definition) Graph.unregisterNode(shape);
    });
    previous?.();
  }
  renderEdgeLabel(args: {
    edge: { id: string; getData<T = Record<string, unknown>>(): T };
    label: unknown;
    container: Element;
    selectors?: Record<string, Element | Element[]>;
  }): (() => void) | undefined {
    const typeName = this.getEdgeType(args.edge.id);
    if (!typeName) return undefined;
    const typeEntry = this.getEdgeConfig(typeName);
    if (!typeEntry?.component) return undefined;

    const foContent = args.selectors?.foContent;
    const mountEl = (Array.isArray(foContent) ? foContent[0] : foContent) ?? args.container;
    this.roots.get(mountEl)?.release();
    const root = createRoot(mountEl);
    let active = true;
    const release = () => {
      if (!active) return;
      active = false;
      if (this.roots.get(mountEl)?.root === root) this.roots.delete(mountEl);
      root.unmount();
    };
    this.roots.set(mountEl, { root, release });
    const data = args.edge.getData() ?? {};
    root.render(createElement(typeEntry.component, { edge: args.edge, data }));

    return release;
  }
  dispose(): void {
    const entries = [...this.roots.values()];
    this.roots.clear();
    runCleanupTasks([
      ...entries.map((entry) => entry.release),
      () => {
        this.releaseShapes();
      },
    ]);
  }
}
