import { cloneContribution } from "./clone-contribution";
import { SettingType } from "@flow-designer/model";
import type {
  NodeDefinition,
  SettingConfig,
  FormatterConfig,
  PrototypeRegistry,
} from "@flow-designer/model";
import type { NodeMeta, NodeView } from "@flow-designer/graph";
import type { EditorField, UiSettingConfig } from "./ui-settings";
import { SetterRegistry } from "./setter-registry";
export interface NodeDefinitionBundle {
  meta: NodeMeta;
  view: NodeView;
  schema: NodeDefinition["schema"];
  editor: EditorField[];
  lifecycle?: NodeDefinition["lifecycle"];
  readonly domain: NodeDefinition;
}
interface Entry {
  bundle: NodeDefinitionBundle;
  namespace: string;
  domain: ReturnType<PrototypeRegistry["registerOwned"]>;
}
export class UiContributionRegistry {
  readonly setters = new SetterRegistry();
  private nodes = new Map<string, Entry[]>();
  private fields = new Map<string, UiSettingConfig>();
  private listeners = new Set<{ listener: () => void }>();
  private sequence = 0;
  private notify(): void {
    for (const entry of this.listeners) entry.listener();
  }
  onChange(listener: () => void): () => void {
    const entry = { listener };
    this.listeners.add(entry);
    return () => {
      this.listeners.delete(entry);
    };
  }
  getNode(typeName: string): NodeDefinitionBundle | null {
    return this.nodes.get(typeName)?.slice(-1)[0]?.bundle ?? null;
  }
  getNodes(): NodeDefinitionBundle[] {
    return [...this.nodes.values()].flatMap((entries) => entries[entries.length - 1]?.bundle ?? []);
  }
  getField(key: string | undefined): UiSettingConfig | undefined {
    return key ? this.fields.get(key) : undefined;
  }
  private clearFields(namespace: string): void {
    for (const key of this.fields.keys())
      if (key.startsWith(`${namespace}/`)) this.fields.delete(key);
  }
  compileSettings<T>(configs: UiSettingConfig<T>[], namespace: string): SettingConfig<T>[] {
    return configs.map((config, index) => {
      const key = `${namespace}/${String(index)}`;
      this.fields.set(key, config);
      let setter = config.setter;
      let explicitCodec: FormatterConfig<T> | undefined;
      if (typeof setter === "string") setter = this.setters.getSetter(setter) ?? undefined;
      else if (
        setter &&
        typeof setter === "object" &&
        "type" in setter &&
        typeof setter.type === "string"
      ) {
        explicitCodec = "formatter" in setter ? setter.formatter : undefined;
        setter = this.setters.getSetter(setter.type) ?? undefined;
      }
      let setterCodec: FormatterConfig<T> | undefined = explicitCodec;
      if (
        !setterCodec &&
        (typeof setter === "function" || (setter !== null && typeof setter === "object"))
      ) {
        const source: unknown =
          "type" in setter && typeof setter.type === "function" ? setter.type : setter;
        if (typeof source === "function" || (source !== null && typeof source === "object")) {
          const codec: unknown = Reflect.get(source, "formater");
          if (
            codec !== null &&
            typeof codec === "object" &&
            "formatIn" in codec &&
            typeof codec.formatIn === "function" &&
            "formatOut" in codec &&
            typeof codec.formatOut === "function"
          )
            setterCodec = codec as FormatterConfig<T>;
        }
      }
      const codec = config.formatter;
      const formatter: FormatterConfig<T> | undefined =
        codec || setterCodec
          ? {
              formatIn(context, value) {
                const input: unknown = codec ? codec.formatIn(context, value) : value;
                return setterCodec ? setterCodec.formatIn(context, input) : input;
              },
              formatOut(context, value) {
                const output: unknown = setterCodec ? setterCodec.formatOut(context, value) : value;
                return codec ? codec.formatOut(context, output) : output;
              },
            }
          : undefined;
      return {
        key,
        type: config.type,
        target: config.target,
        formatter,
        items: config.items ? this.compileSettings(config.items, key) : undefined,
      };
    });
  }
  private compile(bundle: NodeDefinitionBundle, namespace: string): NodeDefinition {
    const convert = (field: EditorField): UiSettingConfig => ({
      ...field,
      type: field.type === "group" ? SettingType.Group : SettingType.Item,
      display: field.display as UiSettingConfig["display"],
      items: field.items?.map(convert),
      formatter: field.formatter
        ? {
            formatIn: (_, value) =>
              field.formatter?.deserialize ? field.formatter.deserialize(value) : value,
            formatOut: (_, value) =>
              field.formatter?.serialize ? field.formatter.serialize(value) : value,
          }
        : undefined,
    });
    return {
      ...bundle.domain,
      meta: {
        name: bundle.meta.name,
        typeName: bundle.meta.typeName,
        description: bundle.meta.description,
      },
      schema: bundle.schema,
      settings: this.compileSettings(bundle.editor.map(convert), namespace),
    };
  }
  register(input: NodeDefinitionBundle, prototypes: PrototypeRegistry): () => void {
    const bundle = cloneContribution(input);
    const typeName = bundle.meta.typeName;
    const namespace = `node:${typeName}:${String(++this.sequence)}`;
    const entry: Entry = {
      bundle,
      namespace,
      domain: prototypes.registerOwned(this.compile(bundle, namespace)),
    };
    const entries = this.nodes.get(typeName) ?? [];
    entries.push(entry);
    this.nodes.set(typeName, entries);
    this.notify();
    return () => {
      const current = this.nodes.get(typeName);
      const index = current?.indexOf(entry) ?? -1;
      if (!current || index < 0) return;
      current.splice(index, 1);
      if (!current.length) this.nodes.delete(typeName);
      entry.domain.dispose();
      this.clearFields(namespace);
      this.notify();
    };
  }
  replace(input: NodeDefinitionBundle, _prototypes: PrototypeRegistry): boolean {
    const entry = this.nodes.get(input.meta.typeName)?.slice(-1)[0];
    if (!entry) return false;
    entry.bundle = cloneContribution(input);
    this.clearFields(entry.namespace);
    entry.domain.replace(this.compile(entry.bundle, entry.namespace));
    this.notify();
    return true;
  }
  dispose(): void {
    for (const entries of this.nodes.values())
      for (const entry of [...entries].reverse()) entry.domain.dispose();
    this.nodes.clear();
    this.fields.clear();
    this.listeners.clear();
    this.setters.dispose();
  }
}
