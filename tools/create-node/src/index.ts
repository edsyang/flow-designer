#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import prompts from "prompts";
import { generatePackageJson } from "./templates/package-json.js";
import {
  generateTsconfig,
  generateViteConfig,
  generateVitestConfig,
} from "./templates/config-files.js";
import { generateBpmnNodeDef, generateBpmnIndex, generateBpmnTest } from "./templates/bpmn.js";
import {
  generateComfyUINodeDef,
  generateComfyUIIndex,
  generateComfyUITest,
} from "./templates/comfyui.js";
import {
  generateGenericNodeDef,
  generateGenericIndex,
  generateGenericTest,
} from "./templates/generic.js";
import { generateERNodeDef, generateERIndex, generateERTest } from "./templates/er.js";

type Preset = "bpmn" | "comfyui" | "er" | "generic";

const BPMN_CATEGORIES = [
  { title: "events", value: "events" },
  { title: "gateways", value: "gateways" },
  { title: "tasks", value: "tasks" },
];

const COMFYUI_CATEGORIES = [
  { title: "loaders", value: "loaders" },
  { title: "sampling", value: "sampling" },
  { title: "conditioning", value: "conditioning" },
  { title: "latent", value: "latent" },
  { title: "image", value: "image" },
];

const ER_CATEGORIES = [
  { title: "tables", value: "tables" },
  { title: "views", value: "views" },
  { title: "enums", value: "enums" },
];

function isValidKebabCase(name: string): boolean | string {
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
    return "请使用 kebab-case 格式 (如: my-node)";
  }
  return true;
}

async function main(): Promise<void> {
  console.log("\n  Flow Designer — 节点脚手架\n");

  const response = await prompts(
    [
      {
        type: "text",
        name: "name",
        message: "节点名称 (kebab-case)",
        validate: isValidKebabCase,
      },
      {
        type: "select",
        name: "preset",
        message: "选择预设",
        choices: [
          { title: "BPMN — 流程控制节点（方向型端口）", value: "bpmn" },
          { title: "ComfyUI — 数据流节点（类型化端口）", value: "comfyui" },
          { title: "ER — 数据库建模节点（类型化端口）", value: "er" },
          { title: "通用 — 自定义节点（带详细注释）", value: "generic" },
        ],
      },
    ],
    {
      onCancel: () => {
        process.exit(0);
      },
    },
  );

  if (!response.name || !response.preset) return;

  const preset = response.preset as Preset;
  let category: string;

  if (preset === "bpmn") {
    const catResponse = await prompts(
      {
        type: "select",
        name: "category",
        message: "节点类别",
        choices: BPMN_CATEGORIES,
      },
      {
        onCancel: () => {
          process.exit(0);
        },
      },
    );
    category = catResponse.category;
  } else if (preset === "comfyui") {
    const catResponse = await prompts(
      {
        type: "select",
        name: "category",
        message: "节点类别",
        choices: COMFYUI_CATEGORIES,
      },
      {
        onCancel: () => {
          process.exit(0);
        },
      },
    );
    category = catResponse.category;
  } else if (preset === "er") {
    const catResponse = await prompts(
      {
        type: "select",
        name: "category",
        message: "节点类别",
        choices: ER_CATEGORIES,
      },
      {
        onCancel: () => {
          process.exit(0);
        },
      },
    );
    category = catResponse.category;
  } else {
    const catResponse = await prompts(
      {
        type: "text",
        name: "category",
        message: "节点类别",
        initial: "custom",
      },
      {
        onCancel: () => {
          process.exit(0);
        },
      },
    );
    category = catResponse.category;
  }

  if (!category) return;

  const dirResponse = await prompts(
    {
      type: "text",
      name: "outDir",
      message: "输出目录",
      initial: `./${response.name}`,
    },
    {
      onCancel: () => {
        process.exit(0);
      },
    },
  );

  if (!dirResponse.outDir) return;

  const kebabName: string = response.name;
  const outDir = path.resolve(dirResponse.outDir);
  const pkgName = kebabName;
  const templateOpts = { kebabName, category };

  let nodeDef: string;
  let indexFile: string;
  let testFile: string;

  if (preset === "bpmn") {
    nodeDef = generateBpmnNodeDef(templateOpts);
    indexFile = generateBpmnIndex(templateOpts);
    testFile = generateBpmnTest(templateOpts);
  } else if (preset === "comfyui") {
    nodeDef = generateComfyUINodeDef(templateOpts);
    indexFile = generateComfyUIIndex(templateOpts);
    testFile = generateComfyUITest(templateOpts);
  } else if (preset === "er") {
    nodeDef = generateERNodeDef(templateOpts);
    indexFile = generateERIndex(templateOpts);
    testFile = generateERTest(templateOpts);
  } else {
    nodeDef = generateGenericNodeDef(templateOpts);
    indexFile = generateGenericIndex(templateOpts);
    testFile = generateGenericTest(templateOpts);
  }

  const files: Array<{ relativePath: string; content: string }> = [
    { relativePath: "package.json", content: generatePackageJson(pkgName) },
    { relativePath: "tsconfig.json", content: generateTsconfig() },
    { relativePath: "vite.config.ts", content: generateViteConfig() },
    { relativePath: "vitest.config.ts", content: generateVitestConfig() },
    { relativePath: `src/${kebabName}.ts`, content: nodeDef },
    { relativePath: "src/index.ts", content: indexFile },
    { relativePath: `__tests__/${kebabName}.test.ts`, content: testFile },
  ];

  for (const file of files) {
    const filePath = path.join(outDir, file.relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, file.content, "utf-8");
  }

  console.log(`\n✔ 已生成节点包:\n`);
  console.log(`  ${path.basename(outDir)}/`);
  console.log(`  ├── package.json`);
  console.log(`  ├── tsconfig.json`);
  console.log(`  ├── vite.config.ts`);
  console.log(`  ├── vitest.config.ts`);
  console.log(`  ├── src/`);
  console.log(`  │   ├── index.ts`);
  console.log(`  │   └── ${kebabName}.ts`);
  console.log(`  └── __tests__/`);
  console.log(`      └── ${kebabName}.test.ts`);
  console.log();
}

main().catch(console.error);
