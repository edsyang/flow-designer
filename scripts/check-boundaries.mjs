import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url)).replace(/\/$/, "");
const require = createRequire(root + "/package.json");
const { ESLint, Linter } = require("eslint");
const eslint = new ESLint({ cwd: root });
const linter = new Linter();
const cases = [
  [
    "packages/i18n/src/catalog/graph.ts",
    "import {GraphManager} from '@flow-designer/graph';",
    true,
  ],
  ["packages/i18n/src/catalog/workbench.ts", "import {createElement} from 'react';", true],
  [
    "packages/i18n/src/catalog/index.ts",
    "import {coreMessages} from '@flow-designer/engine';",
    true,
  ],
  ["packages/i18n/src/catalog/index.ts", "import {graphMessages} from './graph';", false],
  ["packages/i18n/src/index.ts", "import {Document} from '@flow-designer/model';", true],
  ["packages/i18n/src/index.ts", "import {createElement} from 'react';", true],
  ["packages/i18n/src/react.tsx", "import {createContext} from 'react';", false],
  ["packages/core/src/editor.ts", "import {useTranslate} from '@flow-designer/i18n/react';", true],
  ["packages/core/src/editor.ts", "import {t} from '@flow-designer/i18n';", false],
  ["packages/core/src/editor.ts", "import {createElement} from 'react';", true],
  ["packages/core/src/editor.ts", "import type {ReactNode} from 'react';", false],
  ["packages/core/src/editor.ts", "import {Workbench} from '@flow-designer/react';", true],
  ["packages/core/src/editor.ts", "export {Engine} from '@flow-designer/engine';", true],
  ["packages/core/src/editor.ts", "import {x} from '../../react/src/index';", true],
  ["packages/core/src/editor.ts", "import {Document} from '@flow-designer/model';", false],
  ["packages/core/src/utils/create-content.ts", "import {createElement} from 'react';", true],
  ["packages/core/src/utils/create-content.ts", "import type {ReactNode} from 'react';", false],
  ["packages/core/src/index.ts", "export {createContent} from '@flow-designer/skeleton';", true],
  [
    "packages/core/src/index.ts",
    "export {createContent} from '../../skeleton/src/create-content';",
    true,
  ],
  ["packages/skeleton/src/create-content.ts", "import {createElement} from 'react';", false],
  [
    "packages/core/src/utils/create-content.ts",
    "import {x} from '@flow-designer/bpmn-model';",
    true,
  ],
  ["packages/graph/src/index.ts", "import {Graph} from '@antv/x6';", false],
  ["apps/bpmn/app/src/app.tsx", "import {x} from '@flow-designer/bpmn-model';", false],
];
for (const pkg of [
  "i18n",
  "core",
  "model",
  "graph",
  "plugins",
  "react",
  "skeleton",
  "setters",
  "engine",
]) {
  cases.push([
    `packages/${pkg}/src/index.ts`,
    "import {x} from '@flow-designer/comfyui-nodes';",
    true,
  ]);
  cases.push([
    `packages/${pkg}/src/index.ts`,
    "export {x} from '@flow-designer/er-nodes/src/table';",
    true,
  ]);
  cases.push([
    `packages/${pkg}/src/index.ts`,
    "import {x} from '../../../apps/bpmn/model/src/index';",
    true,
  ]);
}
// Boundaries are expressed with the TypeScript-aware variant of the rule; the
// core `no-restricted-imports` name is kept as a fallback for configs that opt out
// of the plugin.
const RESTRICTED_IMPORT_RULES = [
  "@typescript-eslint/no-restricted-imports",
  "no-restricted-imports",
];
for (const [file, code, rejected] of cases) {
  const config = await eslint.calculateConfigForFile(root + "/" + file);
  assert(config, `No config for ${file}`);
  const ruleName = RESTRICTED_IMPORT_RULES.find((name) => config.rules[name] !== undefined);
  const rules = ruleName ? { [ruleName]: config.rules[ruleName] } : {};
  const messages = linter.verify(code, {
    languageOptions: {
      parser: config.languageOptions.parser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    },
    plugins: config.plugins,
    rules,
  });
  assert(!messages.some((m) => m.fatal), JSON.stringify(messages));
  assert.equal(messages.length > 0, rejected, `${file}: ${code}: ${JSON.stringify(messages)}`);
}
console.log(`${cases.length} import-boundary assertions passed`);
