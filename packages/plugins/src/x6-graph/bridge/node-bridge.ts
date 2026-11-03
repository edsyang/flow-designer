import type { ContentNode } from "@flow-designer/model";
import { prototypeRegistry } from "@flow-designer/model";
import { subscribeLocale } from "@flow-designer/model";
import type { GraphManager } from "@flow-designer/graph";
import type { GraphBridge } from "./graph-bridge";
import { truncateLabel } from "./graph-bridge";

interface X6NodeHandle {
  isNode(): boolean;
  position(): { x: number; y: number };
  position(x: number, y: number): void;
  setAttrs(attrs: Record<string, unknown>): void;
  setPortProp(portId: string, path: string, value: unknown): void;
}

export class NodeBridge {
  private unsubscribe: () => void;
  private unsubscribeLocale: () => void;
  private label: string;

  constructor(
    private graphManager: GraphManager,
    private node: ContentNode,
    private bridge: GraphBridge,
  ) {
    this.label = this.getLabel();
    this.unsubscribe = node.onPropsChange((changing) => {
      if (changing.has("__position")) {
        const isEcho =
          this.bridge.getSyncDirection() === "graph-to-model" ||
          this.bridge.consumePositionEcho(node.getId());
        if (!isEcho) {
          const { x, y } = node.getPosition();
          const cell = this.graphManager.getCellById(node.getId()) as X6NodeHandle | null;
          if (cell?.isNode?.()) {
            const current = cell.position();
            if (current.x !== x || current.y !== y) cell.position(x, y);
          }
        }
      }
      if (changing.has("name")) {
        const label = this.getLabel();
        const cell = this.graphManager.getCellById(node.getId()) as X6NodeHandle | null;
        if (cell?.isNode?.() && this.label !== label) cell.setAttrs({ label: { text: label } });
        this.label = label;
      }
      if ([...changing].some((key) => key !== "__position")) {
        this.graphManager.updateNodeData(node.getId(), { contentNode: node });
      }
    });
    this.unsubscribeLocale = subscribeLocale(() => { this.refresh(); });
  }

  refresh(): void {
    const cell = this.graphManager.getCellById(this.node.getId()) as X6NodeHandle | null;
    if (!cell?.isNode?.()) return;
    const { x, y } = this.node.getPosition();
    const current = cell.position();
    if (current.x !== x || current.y !== y) cell.position(x, y);
    const prototype = prototypeRegistry.getPrototypeByType(this.node.getTypeName());
    for (const port of prototype?.getView().ports ?? []) {
      if (port.id && port.label) cell.setPortProp(port.id, "attrs/title/text", port.label);
    }
    const label = this.getLabel();
    if (this.label !== label) cell.setAttrs({ label: { text: label } });
    this.label = label;
  }

  private getLabel(): string {
    const prototype = prototypeRegistry.getPrototypeByType(this.node.getTypeName());
    const name = this.node.getProps().getProp("name")?.getData() as string | undefined;
    return truncateLabel(
      prototype?.getNameForValue(name) ?? name ?? this.node.getTypeName(),
      prototype?.getView().shape,
    );
  }

  dispose(): void {
    this.unsubscribe();
    this.unsubscribeLocale();
  }
}
