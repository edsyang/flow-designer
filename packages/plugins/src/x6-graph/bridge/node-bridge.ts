import type { ContentNode } from "@flow-designer/model";
import { prototypeRegistry } from "@flow-designer/model";
import { subscribeLocale } from "@flow-designer/i18n";
import type { GraphPort } from "@flow-designer/core";
import type { GraphBridge } from "./graph-bridge";
import { truncateLabel } from "./graph-bridge";

export class NodeBridge {
  private unsubscribe: () => void;
  private unsubscribeLocale: () => void;
  private label: string;

  constructor(
    private graphManager: GraphPort,
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
          this.graphManager.patchNode({ nodeId: node.getId(), position: { x, y } });
        }
      }
      if (changing.has("name")) {
        const label = this.getLabel();
        if (this.label !== label) this.graphManager.patchNode({ nodeId: node.getId(), label });
        this.label = label;
      }
      if ([...changing].some((key) => key !== "__position")) {
        this.graphManager.updateNodeData(node.getId(), { contentNode: node });
      }
    });
    this.unsubscribeLocale = subscribeLocale(() => {
      this.refresh();
    });
  }

  refresh(): void {
    const prototype = prototypeRegistry.getPrototypeByType(this.node.getTypeName());
    const label = this.getLabel();
    this.graphManager.patchNode({
      nodeId: this.node.getId(),
      position: this.node.getPosition(),
      ...(this.label !== label ? { label } : {}),
      portLabels: (prototype?.getView().ports ?? []).flatMap((port) =>
        port.id && port.label ? [{ portId: port.id, label: port.label }] : [],
      ),
    });
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
