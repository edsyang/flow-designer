import { prototypeRegistry, t } from "@flow-designer/model";
export { erMessages } from "./i18n";
import type { NodeDefinition } from "@flow-designer/model";
import { tableDef } from "./table";
import { viewDef } from "./view";
import { enumDef } from "./enum";

export { tableDef } from "./table";
export { viewDef } from "./view";
export { enumDef } from "./enum";
export { ER_CATEGORIES, ER_TYPE_NAMES, ER_DATA_TYPES, ER_DATA_TYPE_COLORS } from "./constants";
export { relationConfig, RELATION_TYPE, getRelationEdgeType } from "./relation";

const allDefs: NodeDefinition[] = [tableDef, viewDef, enumDef];

/**
 * Registers the ER node definitions in the global prototype registry.
 *
 * Idempotent: already-registered types are left to `refreshERTranslations()`,
 * which owns locale updates. Registering an absent type is this function's job.
 */
export function registerERNodes(): void {
  for (const def of allDefs) {
    if (!prototypeRegistry.getPrototypeByType(def.meta.typeName)) {
      prototypeRegistry.register(def);
    }
  }
}

/**
 * Rewrites the shared ER definitions with the active locale and re-registers
 * the types that are already present. It never registers a new type: a
 * translation refresh must not create nodes as a side effect.
 */
export function refreshERTranslations(): void {
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

  for (const def of allDefs) {
    def.meta.name = t(names[def.meta.typeName]!);
    if (def.meta.category && categoryTitles[def.meta.category]) {
      def.meta.categoryTitle = t(categoryTitles[def.meta.category]!);
    }
    for (const field of def.editor) {
      if (typeof field.target === "string" && descriptions[field.target]) {
        field.description = t(descriptions[field.target]!);
      }
    }
    if (prototypeRegistry.getPrototypeByType(def.meta.typeName)) {
      prototypeRegistry.register(def);
    }
  }
}
