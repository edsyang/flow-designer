import type Props from "../props";
import type { PropConfig, ChangeKeys } from "../props/prop";
import type { SettingConfig } from "../settings/setting";
import type ContentNode from "../content/node";
export interface PortDefinition {
  /** Semantic connection capability; position and persisted group/ID remain independent. */
  connectionDirection?: "in" | "out" | "both";
  id?: string;
  group: string;
  position: "top" | "bottom" | "left" | "right";
  maxConnections?: number;
  dataType?: string;
  label?: string;
  color?: string;
  attrs?: Record<string, unknown>;
}

export interface PropSchema {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array" | "enum";
  defaultValue?: unknown;
  required?: boolean;
  properties?: PropSchema[];
  items?: PropSchema;
  enum?: Array<{ label: string; value: string }>;
}

export interface NodeLifecycle {
  propsDidChange?(
    changing: ChangeKeys,
    props: Props<ContentNode<any>>,
    node: ContentNode<any>,
  ): void;
  nodeDidInit?(node: ContentNode<any>, isAdd: boolean): void;
  nodeDidAdd?(node: ContentNode<any>): void;
  nodeDidPurge?(node: ContentNode<any>): void;
}

/** UI-independent node behavior and persistence definition. */
export interface NodeDefinition {
  meta: { name: string; typeName: string; description?: string };
  schema: PropSchema[];
  props?: PropConfig[];
  settings?: Array<SettingConfig<ContentNode<any>>>;
  lifecycle?: NodeLifecycle;
  connection?: { ports: PortDefinition[] };
  creation?: { size: { width: number; height: number } };
  capabilities?: { copyable?: boolean; deletable?: boolean };
}
export default class Prototype {
  constructor(private definition: NodeDefinition) {}
  updateDefinition(definition: NodeDefinition): void {
    this.updateConfig(definition);
  }
  updateConfig(definition: NodeDefinition): void {
    if (definition.meta.typeName !== this.getTypeName())
      throw new Error(
        `Cannot update prototype ${this.getTypeName()} with ${definition.meta.typeName}`,
      );
    this.definition = definition;
  }
  getDefinition(): NodeDefinition {
    return this.definition;
  }
  getName(): string {
    return this.definition.meta.name;
  }
  getNameForValue(value?: string): string {
    const defaultName = this.definition.schema.find((field) => field.name === "name")?.defaultValue;
    return !value || value === defaultName ? this.getName() : value;
  }
  getTypeName(): string {
    return this.definition.meta.typeName;
  }
  getSchema(): PropSchema[] {
    return this.definition.schema;
  }
  getSettings(): Array<SettingConfig<ContentNode<any>>> {
    return this.definition.settings ?? [];
  }
  getProps(): PropConfig[] {
    return (
      this.definition.props ??
      this.definition.schema.map((field) => ({
        name: field.name,
        defaultValue: field.defaultValue,
      }))
    );
  }
  getPorts(): PortDefinition[] {
    return this.definition.connection?.ports ?? [];
  }
  getInitialSize(): { width: number; height: number } {
    return this.definition.creation?.size ?? { width: 140, height: 40 };
  }
  getCapabilities(): { copyable?: boolean; deletable?: boolean } {
    return this.definition.capabilities ?? {};
  }
  propsDidChange(
    changing: ChangeKeys,
    props: Props<ContentNode<any>>,
    node: ContentNode<any>,
  ): void {
    this.definition.lifecycle?.propsDidChange?.(changing, props, node);
  }
  nodeDidInit(node: ContentNode<any>, isAdd = false): void {
    this.definition.lifecycle?.nodeDidInit?.(node, isAdd);
  }
  nodeDidAdd(node: ContentNode<any>): void {
    this.definition.lifecycle?.nodeDidAdd?.(node);
  }
  nodeDidPurge(node: ContentNode<any>): void {
    this.definition.lifecycle?.nodeDidPurge?.(node);
  }
}
