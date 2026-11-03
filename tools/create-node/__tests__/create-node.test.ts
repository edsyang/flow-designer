import { describe, it, expect } from "vitest";
import { toPascalCase, toCamelCase, toDefName, toRegisterFnName } from "../src/utils";
import { generatePackageJson } from "../src/templates/package-json";
import {
  generateTsconfig,
  generateViteConfig,
  generateVitestConfig,
} from "../src/templates/config-files";
import { generateBpmnNodeDef, generateBpmnIndex, generateBpmnTest } from "../src/templates/bpmn";
import {
  generateComfyUINodeDef,
  generateComfyUIIndex,
  generateComfyUITest,
} from "../src/templates/comfyui";
import {
  generateGenericNodeDef,
  generateGenericIndex,
  generateGenericTest,
} from "../src/templates/generic";
import { generateERNodeDef, generateERIndex, generateERTest } from "../src/templates/er";

describe("utils", () => {
  it("toPascalCase", () => {
    expect(toPascalCase("my-approval")).toBe("MyApproval");
    expect(toPascalCase("save-image")).toBe("SaveImage");
    expect(toPascalCase("node")).toBe("Node");
  });

  it("toCamelCase", () => {
    expect(toCamelCase("my-approval")).toBe("myApproval");
    expect(toCamelCase("node")).toBe("node");
  });

  it("toDefName", () => {
    expect(toDefName("my-approval")).toBe("myApprovalDef");
  });

  it("toRegisterFnName", () => {
    expect(toRegisterFnName("my-approval")).toBe("registerMyApprovalNodes");
  });
});

describe("package-json template", () => {
  it("should generate valid JSON with correct name", () => {
    const result = generatePackageJson("my-node");
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe("my-node");
    expect(parsed.peerDependencies["@flow-designer/model"]).toBe("^0.1.0");
    expect(parsed.peerDependencies["@flow-designer/setters"]).toBe("^0.1.0");
    expect(parsed.type).toBe("module");
  });
});

describe("config-files templates", () => {
  it("tsconfig should have strict and jsx", () => {
    const result = generateTsconfig();
    const parsed = JSON.parse(result);
    expect(parsed.compilerOptions.strict).toBe(true);
    expect(parsed.compilerOptions.jsx).toBe("react-jsx");
    expect(parsed.compilerOptions.module).toBe("ESNext");
  });

  it("vite.config should externalize @flow-designer/*", () => {
    const result = generateViteConfig();
    expect(result).toContain("@flow-designer");
    expect(result).toContain("entry: 'src/index.ts'");
  });

  it("vitest.config should include __tests__", () => {
    const result = generateVitestConfig();
    expect(result).toContain("__tests__/**/*.test.ts");
  });
});

describe("BPMN templates", () => {
  const opts = { kebabName: "my-approval", category: "tasks" };

  it("node def should use defineNode with directional ports", () => {
    const result = generateBpmnNodeDef(opts);
    expect(result).toContain("import { defineNode } from '@flow-designer/model'");
    expect(result).toContain("export const myApprovalDef = defineNode(");
    expect(result).toContain("name: 'MyApproval'");
    expect(result).toContain("category: 'tasks'");
    expect(result).toContain("position: 'top'");
    expect(result).toContain("position: 'bottom'");
    expect(result).not.toContain("dataType");
  });

  it("index should export def and register function", () => {
    const result = generateBpmnIndex(opts);
    expect(result).toContain("export { myApprovalDef }");
    expect(result).toContain("export function registerMyApprovalNodes()");
    expect(result).toContain("prototypeRegistry.register(myApprovalDef)");
  });

  it("test should verify meta and ports", () => {
    const result = generateBpmnTest(opts);
    expect(result).toContain("describe('MyApproval'");
    expect(result).toContain("myApprovalDef");
    expect(result).toContain("directional ports");
  });
});

describe("ComfyUI templates", () => {
  const opts = { kebabName: "my-filter", category: "image" };

  it("node def should use typed ports with dataType and color", () => {
    const result = generateComfyUINodeDef(opts);
    expect(result).toContain("import { defineNode } from '@flow-designer/model'");
    expect(result).toContain("export const myFilterDef = defineNode(");
    expect(result).toContain("name: 'MyFilter'");
    expect(result).toContain("category: 'image'");
    expect(result).toContain("dataType:");
    expect(result).toContain("color:");
  });

  it("index should export def and register function", () => {
    const result = generateComfyUIIndex(opts);
    expect(result).toContain("export { myFilterDef }");
    expect(result).toContain("export function registerMyFilterNodes()");
  });

  it("test should verify typed ports", () => {
    const result = generateComfyUITest(opts);
    expect(result).toContain("describe('MyFilter'");
    expect(result).toContain("dataType");
    expect(result).toContain("color");
  });

  it("loader category should have no input ports", () => {
    const loaderDef = generateComfyUINodeDef({ kebabName: "my-loader", category: "loaders" });
    expect(loaderDef).not.toContain("group: 'in'");
    expect(loaderDef).toContain("group: 'out'");
  });
});

describe("Generic templates", () => {
  const opts = { kebabName: "my-node", category: "custom" };

  it("node def should have detailed comments", () => {
    const result = generateGenericNodeDef(opts);
    expect(result).toContain("defineNode() 创建一个节点定义");
    expect(result).toContain("可选形状: 'fd-rect'");
    expect(result).toContain("export const myNodeDef = defineNode(");
    expect(result).toContain("category: 'custom'");
  });

  it("index should export def and register function", () => {
    const result = generateGenericIndex(opts);
    expect(result).toContain("export { myNodeDef }");
    expect(result).toContain("export function registerMyNodeNodes()");
  });

  it("test should verify basic structure", () => {
    const result = generateGenericTest(opts);
    expect(result).toContain("describe('MyNode'");
    expect(result).toContain("input and output ports");
  });
});

describe("ER templates", () => {
  const opts = { kebabName: "my-entity", category: "tables" };

  it("node def should use typed ports with ER dataTypes", () => {
    const result = generateERNodeDef(opts);
    expect(result).toContain("import { defineNode } from '@flow-designer/model'");
    expect(result).toContain("export const myEntityDef = defineNode(");
    expect(result).toContain("name: 'MyEntity'");
    expect(result).toContain("category: 'tables'");
    expect(result).toContain("dataType:");
    expect(result).toContain("color:");
    expect(result).toContain("'REFERENCE'");
    expect(result).toContain("'ROW'");
  });

  it("index should export def and register function", () => {
    const result = generateERIndex(opts);
    expect(result).toContain("export { myEntityDef }");
    expect(result).toContain("export function registerMyEntityNodes()");
  });

  it("test should verify typed ports", () => {
    const result = generateERTest(opts);
    expect(result).toContain("describe('MyEntity'");
    expect(result).toContain("dataType");
    expect(result).toContain("color");
  });

  it("enums category should have no input ports", () => {
    const enumDef = generateERNodeDef({ kebabName: "my-enum", category: "enums" });
    expect(enumDef).not.toContain("group: 'in'");
    expect(enumDef).toContain("group: 'out'");
    expect(enumDef).toContain("'ENUM_VALUE'");
  });

  it("views category should have ROW typed ports", () => {
    const viewDef = generateERNodeDef({ kebabName: "my-view", category: "views" });
    expect(viewDef).toContain("group: 'in'");
    expect(viewDef).toContain("group: 'out'");
    expect(viewDef).toContain("'ROW'");
    expect(viewDef).not.toContain("'REFERENCE'");
  });
});

describe("schema-only setter imports", () => {
  it.each([
    ["BPMN", generateBpmnNodeDef],
    ["ComfyUI", generateComfyUINodeDef],
    ["ER", generateERNodeDef],
    ["Generic", generateGenericNodeDef],
  ])("%s node packages import identifiers without loading editor components", (_name, generate) => {
    const source = generate({ kebabName: "light-node", category: "custom" });
    expect(source).toContain("import { BuiltinSetters } from '@flow-designer/setters/constants';");
    expect(source).not.toContain("from '@flow-designer/setters';");
  });
});
