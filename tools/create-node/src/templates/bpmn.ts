import { toPascalCase, toDefName, toRegisterFnName } from "../utils.js";

export interface BpmnTemplateOptions {
  kebabName: string;
  category: string;
}

const BPMN_ICONS: Record<string, string> = {
  events: "⚡",
  gateways: "◇",
  tasks: "📋",
};

export function generateBpmnNodeDef(opts: BpmnTemplateOptions): string {
  const { kebabName, category } = opts;
  const pascalName = toPascalCase(kebabName);
  const defName = toDefName(kebabName);
  const icon = BPMN_ICONS[category] ?? "📋";

  return `import { defineNode } from '@flow-designer/engine/definitions';
import { BuiltinSetters } from '@flow-designer/setters/constants';

export const ${defName} = defineNode({
  meta: {
    name: '${pascalName}',
    typeName: '${pascalName}',
    category: '${category}',
    icon: '${icon}',
  },
  view: {
    type: 'node',
    shape: 'fd-rect',
    defaultSize: { width: 180, height: 40 },
    ports: [
      { group: 'in', position: 'top' },
      { group: 'in', position: 'left' },
      { group: 'out', position: 'bottom' },
      { group: 'out', position: 'right' },
    ],
  },
  schema: [
    { name: 'name', type: 'string', defaultValue: '' },
  ],
  editor: [
    { target: 'name', description: '名称', setter: BuiltinSetters.String },
  ],
});
`;
}

export function generateBpmnIndex(opts: BpmnTemplateOptions): string {
  const { kebabName } = opts;
  const defName = toDefName(kebabName);
  const registerFn = toRegisterFnName(kebabName);

  return `import type { NodeDefinitionRegistry } from '@flow-designer/engine/definitions';
import { ${defName} } from './${kebabName}.js';

export { ${defName} };

export function ${registerFn}(registry: NodeDefinitionRegistry): () => void {
  return registry.ui.register(${defName}, registry.prototypes);
}
`;
}

export function generateBpmnTest(opts: BpmnTemplateOptions): string {
  const { kebabName } = opts;
  const pascalName = toPascalCase(kebabName);
  const defName = toDefName(kebabName);

  return `import { describe, it, expect } from 'vitest';
import { ${defName} } from '../src/${kebabName}.js';

describe('${pascalName}', () => {
  it('should have correct meta', () => {
    expect(${defName}.meta.name).toBe('${pascalName}');
    expect(${defName}.meta.category).toBe('${opts.category}');
  });

  it('should have directional ports', () => {
    const ports = ${defName}.view.ports;
    const inPorts = ports.filter((p: any) => p.group === 'in');
    const outPorts = ports.filter((p: any) => p.group === 'out');
    expect(inPorts.length).toBeGreaterThan(0);
    expect(outPorts.length).toBeGreaterThan(0);
  });

  it('should have schema and editor', () => {
    expect(${defName}.schema.length).toBeGreaterThan(0);
    expect(${defName}.editor.length).toBeGreaterThan(0);
  });
});
`;
}
