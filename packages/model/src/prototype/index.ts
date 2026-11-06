import type { ComponentType, ReactElement } from "react";
import type { PropsData } from "../props";
import type Props from "../props";
import type { PropConfig, ChangeKeys } from "../props/prop";
import type { SettingConfig } from "../settings/setting";
import type ContentNode from "../content/node";

export interface NodeMeta {
  name: string;
  typeName: string;
  description?: string;
  icon?: string | ReactElement;
  category?: string;
  categoryTitle?: string;
}

export interface NodeView {
  type: "node" | "edge";
  quickAdd?: boolean;
  draggable?: boolean;
  deletable?: boolean;
  copyable?: boolean;
  component?: ComponentType<NodeComponentProps>;
  defaultSize?: { width: number; height: number };
  ports?: PortDefinition[];
  shape?: string;
}

export interface NodeComponentProps {
  node: ContentNode;
  selected: boolean;
  data: Record<string, unknown>;
}

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

export interface EditorField {
  type?: "item" | "group";
  target?: string | string[];
  description?: string;
  tip?: string | { content: string; url?: string };
  display?: string;
  setter?: string | ComponentType<any> | { type: string; props?: Record<string, unknown> };
  items?: EditorField[];
  behaviors?: Array<{ prop: string; condition: unknown; value: boolean }>;
  formatter?: { serialize?(val: unknown): unknown; deserialize?(val: unknown): unknown };
  tab?: string;
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

export interface NodeDefinitionInput<S extends PropSchema> {
  meta: NodeMeta;
  view: NodeView;
  schema: S[];
  editor: EditorField[];
  lifecycle?: NodeLifecycle;
}

export interface NodeDefinition {
  meta: NodeMeta;
  view: NodeView;
  schema: PropSchema[];
  editor: EditorField[];
  lifecycle?: NodeLifecycle;
}

export function defineNode<S extends PropSchema>(config: NodeDefinitionInput<S>): NodeDefinition {
  return config;
}

export interface PrototypeConfig {
  name: string;
  typeName?: string;
  category?: string;
  description?: string;
  icon?: string;
  home?: string;
  props?: PropConfig[];
  propsDidChange?: (
    changing: ChangeKeys,
    props: Props<ContentNode<any>>,
    node: ContentNode<any>,
  ) => void;
  nodeDidInit?: (node: ContentNode<any>, isAdd: boolean) => void;
  nodeDidAdd?: (node: ContentNode<any>) => void;
  nodeDidPurge?: (node: ContentNode<any>) => void;
  settings?: Array<SettingConfig<ContentNode<any>>>;
  view: View;
  [extraKey: string]: any;
}

export type View = {
  type: string;
  pulled: boolean;
  shape(): any;
  [key: string]: any;
};

export default class Prototype {
  private definition: NodeDefinition | null = null;
  private legacyConfig: PrototypeConfig | null = null;
  private name: string;
  private typeName: string;
  private description: string;
  private view: NodeView;
  private legacyView: View | null = null;
  private settings: Array<SettingConfig<any>>;
  private propConfigs: PropConfig[];
  private defaultProps!: PropsData;
  private icon?: string;
  private home?: string;
  private category?: string;

  constructor(config: NodeDefinition | PrototypeConfig) {
    if ("meta" in config && "schema" in config) {
      const def = config as NodeDefinition;
      this.definition = def;
      this.name = def.meta.name;
      this.typeName = def.meta.typeName;
      this.description = def.meta.description || this.name;
      this.icon = typeof def.meta.icon === "string" ? def.meta.icon : undefined;
      this.view = def.view;
      this.category = def.meta.category;
      this.settings = def.editor?.map(editorFieldToSettingConfig) || [];
      this.propConfigs = def.schema?.map(schemaToLegacyProp) || [];
    } else {
      this.legacyConfig = config;
      this.name = config.name;
      this.typeName = config.typeName || formatName(this.name);
      this.description = config.description || this.name;
      this.icon = config.icon;
      this.home = config.home;
      this.category = config.category;
      this.legacyView = config.view;
      this.view = legacyViewToNodeView(config.view);
      this.settings = config.settings || [];
      this.propConfigs = config.props || generatePropsFromView(config.view);
    }
  }

  updateDefinition(definition: NodeDefinition): void {
    if (this.definition?.meta.typeName !== definition.meta.typeName) {
      throw new Error(`Cannot update prototype ${this.typeName} with ${definition.meta.typeName}`);
    }
    Object.assign(this, new Prototype(definition));
  }

  getDefinition(): NodeDefinition | null {
    return this.definition;
  }

  getConfig(configKey?: string): any {
    const cfg = this.legacyConfig || this.definition;
    if (!configKey) {
      return cfg;
    }
    return (cfg as any)?.[configKey];
  }

  getName(): string {
    return this.definition?.meta.name ?? this.name;
  }

  getNameForValue(value?: string): string {
    if (!value) return this.getName();
    const defaultName = this.definition?.schema.find(
      (field) => field.name === "name",
    )?.defaultValue;
    return value === defaultName ? this.getName() : value;
  }

  getTypeName(): string {
    return this.typeName;
  }

  getCategory(): string {
    return this.definition?.meta.category ?? this.category ?? "";
  }

  getCategoryTitle(): string {
    return this.definition?.meta.categoryTitle ?? this.getCategory();
  }

  getSchema(): PropSchema[] {
    return this.definition?.schema || [];
  }

  getEditor(): EditorField[] {
    return this.definition?.editor || [];
  }

  getSettings() {
    return this.settings;
  }

  getProps() {
    return this.propConfigs;
  }

  getHome(): string {
    return this.home || "";
  }

  getIcon(): string {
    return typeof this.icon === "string" ? this.icon : "";
  }

  getView(): NodeView {
    return this.view;
  }

  propsDidChange(
    changing: ChangeKeys,
    props: Props<ContentNode<any>>,
    node: ContentNode<any>,
  ): void {
    const lifecycle = this.definition?.lifecycle;
    if (lifecycle?.propsDidChange) {
      lifecycle.propsDidChange(changing, props, node);
    } else if (this.legacyConfig?.propsDidChange) {
      this.legacyConfig.propsDidChange(changing, props, node);
    }
  }

  nodeDidInit(node: ContentNode<any>, isAdd: boolean = false): void {
    const lifecycle = this.definition?.lifecycle;
    if (lifecycle?.nodeDidInit) {
      lifecycle.nodeDidInit(node, isAdd);
    } else if (this.legacyConfig?.nodeDidInit) {
      this.legacyConfig.nodeDidInit(node, isAdd);
    }
  }

  nodeDidAdd(node: ContentNode<any>): void {
    const lifecycle = this.definition?.lifecycle;
    if (lifecycle?.nodeDidAdd) {
      lifecycle.nodeDidAdd(node);
    } else if (this.legacyConfig?.nodeDidAdd) {
      this.legacyConfig.nodeDidAdd(node);
    }
  }

  nodeDidPurge(node: ContentNode<any>): void {
    const lifecycle = this.definition?.lifecycle;
    if (lifecycle?.nodeDidPurge) {
      lifecycle.nodeDidPurge(node);
    } else if (this.legacyConfig?.nodeDidPurge) {
      this.legacyConfig.nodeDidPurge(node);
    }
  }
}

function formatName(name: string): string {
  return name.replace(/\W(\w?)/g, (_a, b) => b.toUpperCase());
}

function generatePropsFromView(view: View): PropConfig[] {
  const { defaultProps = {}, propTypes = {} } = view;
  const props: PropConfig[] = [];
  Object.keys(propTypes).forEach((key) => {
    const config: PropConfig = {
      name: key,
      type: propTypes[key],
      defaultValue: defaultProps[key],
    };
    props.push(config);
  });
  return props;
}

function legacyViewToNodeView(view: View): NodeView {
  const shapeVal: unknown = view.shape;
  return {
    type: view.type === "line" ? "edge" : "node",
    draggable: view.pulled ?? false,
    shape: typeof shapeVal === "string" ? shapeVal : undefined,
  };
}

function schemaToLegacyProp(schema: PropSchema): PropConfig {
  return {
    name: schema.name,
    defaultValue: schema.defaultValue,
  };
}

function editorFieldToSettingConfig(field: EditorField): SettingConfig<any> {
  return {
    type: field.type === "group" ? ("group" as any) : ("item" as any),
    target: field.target,
    get description() {
      return field.description;
    },
    tip: field.tip as any,
    display: field.display as any,
    setter: field.setter as any,
    items: field.items?.map(editorFieldToSettingConfig),
    tab: field.tab,
  };
}
