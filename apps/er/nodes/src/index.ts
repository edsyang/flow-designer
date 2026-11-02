import { prototypeRegistry } from '@flow-designer/model';
import type { NodeDefinition } from '@flow-designer/model';
import { tableDef } from './table';
import { viewDef } from './view';
import { enumDef } from './enum';

export { tableDef } from './table';
export { viewDef } from './view';
export { enumDef } from './enum';
export { ER_CATEGORIES, ER_TYPE_NAMES, ER_DATA_TYPES, ER_DATA_TYPE_COLORS } from './constants';
export { relationConfig, RELATION_TYPE, getRelationEdgeType } from './relation';

const allDefs: NodeDefinition[] = [tableDef, viewDef, enumDef];

export function registerERNodes(): void {
  for (const def of allDefs) {
    prototypeRegistry.register(def);
  }
}
