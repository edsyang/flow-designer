import { toPascalCase, toDefName, toRegisterFnName } from '../utils.js';

export interface ERTemplateOptions {
  kebabName: string;
  category: string;
}

interface PortTmpl {
  id: string;
  dataType: string;
  label: string;
  color: string;
}

const CATEGORY_PORTS: Record<string, { inPorts: PortTmpl[]; outPorts: PortTmpl[] }> = {
  tables: {
    inPorts: [
      { id: 'pk', dataType: 'REFERENCE', label: 'PK', color: '#81c784' },
    ],
    outPorts: [
      { id: 'ref_out', dataType: 'REFERENCE', label: 'FK', color: '#81c784' },
      { id: 'row_out', dataType: 'ROW', label: 'ROW', color: '#4fc3f7' },
    ],
  },
  views: {
    inPorts: [
      { id: 'source', dataType: 'ROW', label: 'SOURCE', color: '#4fc3f7' },
    ],
    outPorts: [
      { id: 'row_out', dataType: 'ROW', label: 'ROW', color: '#4fc3f7' },
    ],
  },
  enums: {
    inPorts: [],
    outPorts: [
      { id: 'enum_out', dataType: 'ENUM_VALUE', label: 'ENUM', color: '#ffb74d' },
    ],
  },
};

function formatPort(p: PortTmpl, group: 'in' | 'out'): string {
  const position = group === 'in' ? 'left' : 'right';
  return `      { id: '${p.id}', group: '${group}', position: '${position}', dataType: '${p.dataType}', label: '${p.label}', color: '${p.color}' },`;
}

export function generateERNodeDef(opts: ERTemplateOptions): string {
  const { kebabName, category } = opts;
  const pascalName = toPascalCase(kebabName);
  const defName = toDefName(kebabName);

  const portConfig = CATEGORY_PORTS[category] ?? CATEGORY_PORTS['tables']!;
  const portLines = [
    ...portConfig.inPorts.map(p => formatPort(p, 'in')),
    ...portConfig.outPorts.map(p => formatPort(p, 'out')),
  ].join('\n');

  return `import { defineNode } from '@flow-designer/model';
import { BuiltinSetters } from '@flow-designer/setters/constants';

export const ${defName} = defineNode({
  meta: {
    name: '${pascalName}',
    typeName: '${pascalName}',
    category: '${category}',
    icon: '🗂',
  },
  view: {
    type: 'node',
    shape: 'fd-rect',
    defaultSize: { width: 280, height: 120 },
    ports: [
${portLines}
    ],
  },
  schema: [
    { name: 'name', type: 'string', defaultValue: '' },
    { name: 'fields', type: 'string', defaultValue: '[]' },
  ],
  editor: [
    { target: 'name', description: '名称', setter: BuiltinSetters.String },
    { target: 'fields', description: 'Fields (JSON)', setter: BuiltinSetters.Json },
  ],
});
`;
}

export function generateERIndex(opts: ERTemplateOptions): string {
  const { kebabName } = opts;
  const defName = toDefName(kebabName);
  const registerFn = toRegisterFnName(kebabName);

  return `import { prototypeRegistry } from '@flow-designer/model';
import { ${defName} } from './${kebabName}.js';

export { ${defName} };

export function ${registerFn}(): void {
  prototypeRegistry.register(${defName});
}
`;
}

export function generateERTest(opts: ERTemplateOptions): string {
  const { kebabName, category } = opts;
  const pascalName = toPascalCase(kebabName);
  const defName = toDefName(kebabName);

  return `import { describe, it, expect } from 'vitest';
import { ${defName} } from '../src/${kebabName}.js';

describe('${pascalName}', () => {
  it('should have correct meta', () => {
    expect(${defName}.meta.name).toBe('${pascalName}');
    expect(${defName}.meta.category).toBe('${category}');
  });

  it('should have typed ports with dataType and color', () => {
    const ports = ${defName}.view.ports;
    for (const port of ports) {
      expect(port).toHaveProperty('dataType');
      expect(port).toHaveProperty('color');
    }
  });

  it('should have schema and editor', () => {
    expect(${defName}.schema.length).toBeGreaterThan(0);
    expect(${defName}.editor.length).toBeGreaterThan(0);
  });
});
`;
}
