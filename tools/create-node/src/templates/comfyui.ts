import { toPascalCase, toDefName, toRegisterFnName } from "../utils.js";

export interface ComfyUITemplateOptions {
  kebabName: string;
  category: string;
}

const CATEGORY_PORTS: Record<string, { inPorts: PortTmpl[]; outPorts: PortTmpl[] }> = {
  loaders: {
    inPorts: [],
    outPorts: [{ id: "output", dataType: "MODEL", label: "MODEL", color: "#b39ddb" }],
  },
  sampling: {
    inPorts: [
      { id: "model", dataType: "MODEL", label: "MODEL", color: "#b39ddb" },
      { id: "conditioning", dataType: "CONDITIONING", label: "CONDITIONING", color: "#ffb74d" },
    ],
    outPorts: [{ id: "output", dataType: "LATENT", label: "LATENT", color: "#ff6e9c" }],
  },
  conditioning: {
    inPorts: [{ id: "clip", dataType: "CLIP", label: "CLIP", color: "#ffd54f" }],
    outPorts: [{ id: "output", dataType: "CONDITIONING", label: "CONDITIONING", color: "#ffb74d" }],
  },
  latent: {
    inPorts: [{ id: "input", dataType: "LATENT", label: "LATENT", color: "#ff6e9c" }],
    outPorts: [{ id: "output", dataType: "IMAGE", label: "IMAGE", color: "#64b5f6" }],
  },
  image: {
    inPorts: [{ id: "input", dataType: "IMAGE", label: "IMAGE", color: "#64b5f6" }],
    outPorts: [{ id: "output", dataType: "IMAGE", label: "IMAGE", color: "#64b5f6" }],
  },
};

interface PortTmpl {
  id: string;
  dataType: string;
  label: string;
  color: string;
}

function formatPort(p: PortTmpl, group: "in" | "out"): string {
  const position = group === "in" ? "left" : "right";
  return `      { id: '${p.id}', group: '${group}', position: '${position}', dataType: '${p.dataType}', label: '${p.label}', color: '${p.color}' },`;
}

export function generateComfyUINodeDef(opts: ComfyUITemplateOptions): string {
  const { kebabName, category } = opts;
  const pascalName = toPascalCase(kebabName);
  const defName = toDefName(kebabName);

  const portConfig = CATEGORY_PORTS[category] ?? CATEGORY_PORTS["image"]!;
  const portLines = [
    ...portConfig.inPorts.map((p) => formatPort(p, "in")),
    ...portConfig.outPorts.map((p) => formatPort(p, "out")),
  ].join("\n");

  return `import { defineNode } from '@flow-designer/model';
import { BuiltinSetters } from '@flow-designer/setters/constants';

export const ${defName} = defineNode({
  meta: {
    name: '${pascalName}',
    typeName: '${pascalName}',
    category: '${category}',
    icon: '🔧',
  },
  view: {
    type: 'node',
    shape: 'fd-rect',
    defaultSize: { width: 240, height: 80 },
    ports: [
${portLines}
    ],
  },
  schema: [
    { name: 'strength', type: 'number', defaultValue: 1 },
  ],
  editor: [
    { target: 'strength', description: 'Strength', setter: BuiltinSetters.Number },
  ],
});
`;
}

export function generateComfyUIIndex(opts: ComfyUITemplateOptions): string {
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

export function generateComfyUITest(opts: ComfyUITemplateOptions): string {
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
