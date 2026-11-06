import type { NodeDefinitionRegistry } from "@flow-designer/engine/definitions";
import { t } from "@flow-designer/i18n";
export { erMessages } from "./i18n";
import type { NodeDefinition } from "@flow-designer/engine/definitions";
import { tableDef } from "./table";
import { viewDef } from "./view";
import { enumDef } from "./enum";

export { tableDef } from "./table";
export { viewDef } from "./view";
export { enumDef } from "./enum";
export { ER_CATEGORIES, ER_TYPE_NAMES, ER_DATA_TYPES, ER_DATA_TYPE_COLORS } from "./constants";
export { relationConfig, RELATION_TYPE, getRelationEdgeType } from "./relation";

export const erNodeDefinitions: NodeDefinition[] = [tableDef, viewDef, enumDef];

/**
 * Registers the ER node definitions in the global prototype registry.
 *
 * Idempotent: already-registered types are left to `refreshERTranslations()`,
 * which owns locale updates. Registering an absent type is this function's job.
 */
export function registerERNodes(registry: NodeDefinitionRegistry): void {
  for (const def of erNodeDefinitions) {
    if (!registry.prototypes.getPrototypeByType(def.meta.typeName)) {
      registry.ui.register(def, registry.prototypes);
    }
  }
}

/**
 * Rewrites the shared ER definitions with the active locale and re-registers
 * the types that are already present. It never registers a new type: a
 * translation refresh must not create nodes as a side effect.
 */
export function refreshERTranslations(registry: NodeDefinitionRegistry): void {
  const names: Record<string, string> = {
    Table: "er.node.table",
    View: "er.node.view",
    Enum: "er.node.enum",
  };
  const descriptions: Record<string, string> = {
    tableName: "er.property.tableName",
    viewName: "er.property.viewName",
    enumName: "er.property.enumName",
    fields: "er.property.fields",
    query: "er.property.query",
    values: "er.property.values",
    primaryKey: "er.property.primaryKey",
  };
  const categoryTitles: Record<string, string> = {
    entities: "er.category.entities",
    enums: "er.category.enums",
  };

  for (const template of erNodeDefinitions) {
    const def = registry.ui.getNode(template.meta.typeName);
    if (!def) continue;
    def.meta.name = t(names[def.meta.typeName]!);
    if (def.meta.category && categoryTitles[def.meta.category]) {
      def.meta.categoryTitle = t(categoryTitles[def.meta.category]!);
    }
    for (const field of def.editor) {
      if (typeof field.target === "string" && descriptions[field.target]) {
        field.description = t(descriptions[field.target]!);
      }
    }
    if (registry.prototypes.getPrototypeByType(def.meta.typeName)) {
      registry.ui.replace(def, registry.prototypes);
    }
  }
}
