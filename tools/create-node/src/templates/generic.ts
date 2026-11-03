import { toPascalCase, toDefName, toRegisterFnName } from "../utils.js";

export interface GenericTemplateOptions {
  kebabName: string;
  category: string;
}

export function generateGenericNodeDef(opts: GenericTemplateOptions): string {
  const { kebabName, category } = opts;
  const pascalName = toPascalCase(kebabName);
  const defName = toDefName(kebabName);

  return `import { defineNode } from '@flow-designer/model';
import { BuiltinSetters } from '@flow-designer/setters/constants';

// defineNode() 创建一个节点定义，包含四个部分：
// - meta: 节点元信息（名称、类别、图标）
// - view: 视觉配置（形状、尺寸、端口）
// - schema: 数据模型（属性名、类型、默认值）
// - editor: 属性面板配置（使用哪个 Setter 组件编辑）
export const ${defName} = defineNode({
  meta: {
    name: '${pascalName}',
    typeName: '${pascalName}',
    // category 决定节点在左侧面板中的分组
    category: '${category}',
    icon: '📦',
  },
  view: {
    type: 'node',
    // 可选形状: 'fd-rect'(矩形), 'fd-circle'(圆形), 'fd-diamond'(菱形)
    shape: 'fd-rect',
    defaultSize: { width: 200, height: 60 },
    // 端口定义:
    // - group: 'in'(输入) | 'out'(输出)
    // - position: 'top' | 'bottom' | 'left' | 'right'
    // - 可选: id, dataType, label, color (用于类型化端口连线校验)
    ports: [
      { group: 'in', position: 'left' },
      { group: 'out', position: 'right' },
    ],
  },
  schema: [
    // type 可选: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'enum'
    { name: 'name', type: 'string', defaultValue: '' },
  ],
  editor: [
    // setter 可选: BuiltinSetters.String | .Number | .Boolean | .Select
    //              | .TextArea | .Json | .Color | .RadioGroup
    { target: 'name', description: '名称', setter: BuiltinSetters.String },
  ],
});
`;
}

export function generateGenericIndex(opts: GenericTemplateOptions): string {
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

export function generateGenericTest(opts: GenericTemplateOptions): string {
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

  it('should have input and output ports', () => {
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
