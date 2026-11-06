import type {
  NodeDefinition as DomainNodeDefinition,
  PropSchema,
  PrototypeRegistry,
} from "@flow-designer/model";
import type { NodeDefinitionBundle, UiContributionRegistry } from "@flow-designer/skeleton";
export type { NodeDefinitionBundle, EditorField, UiSettingConfig } from "@flow-designer/skeleton";
export type NodeDefinition = NodeDefinitionBundle;
export type NodeDefinitionInput<S extends PropSchema = PropSchema> = Omit<
  NodeDefinitionBundle,
  "domain" | "schema"
> & { schema: S[] };
/** Pure composition description. Register explicitly with the engine, never the model registry. */
export function defineNode<S extends PropSchema>(
  config: NodeDefinitionInput<S>,
): NodeDefinitionBundle {
  return {
    ...config,
    get domain(): DomainNodeDefinition {
      const { meta, view, schema, lifecycle } = this;
      return {
        meta: {
          get name() {
            return meta.name;
          },
          typeName: meta.typeName,
          get description() {
            return meta.description;
          },
        },
        schema,
        lifecycle,
        connection: { ports: view.ports ?? [] },
        creation: { size: view.defaultSize ?? { width: 140, height: 40 } },
        capabilities: { copyable: view.copyable, deletable: view.deletable },
      };
    },
  };
}
export interface NodeDefinitionRegistry {
  prototypes: PrototypeRegistry;
  ui: UiContributionRegistry;
}
