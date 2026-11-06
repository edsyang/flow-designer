# Flow Designer

[简体中文](./README.zh-CN.md)

![CI](https://github.com/edsyang/flow-designer/actions/workflows/ci.yml/badge.svg)

Flow Designer is an extensible visual flow-editor framework built with React, TypeScript, and AntV X6. It separates generic editor capabilities from domain-specific behavior and includes examples for BPMN processes, ComfyUI dataflows, ER diagrams, and custom node graphs.

> This project is under active development. The repository contains framework workspace packages and example applications; APIs and release status may change.

## Features

- **Scenario-neutral core**: Reuse the document model, plugin lifecycle, graph canvas, workbench, and property editors across scenarios.
- **Extensible node model**: Declare node views, ports, data schemas, and property editors with `defineNode()`.
- **Composable behavior**: Add custom plugins and enable or disable built-in plugins.
- **Typed connections**: Declare port data types and configure connection validators.
- **Import and export**: Use `ContentTransformer` to map between the internal document model and scenario-specific formats.
- **Runnable examples**: Explore separate BPMN, ComfyUI, and ER applications in the workspace.

## Localization

The workbench and the BPMN, ComfyUI, and ER examples support Simplified Chinese and English. Simplified Chinese is the default; the language selector saves the choice in browser storage.

Translation state lives in `@flow-designer/i18n`, independently of model, React, browser storage and application catalogs. Custom applications pass scenario messages to `createDesigner`; built-in framework messages are included automatically and the engine adds scenario messages before plugins start:

```ts
import { createDesigner } from "@flow-designer/engine";
import { setLocale } from "@flow-designer/i18n";

const designer = await createDesigner({
  documentType: "*",
  documentVersion: "1.0.0",
  localeMessages: {
    "en-US": {
      "custom.node.title": "My node",
    },
    "zh-CN": {
      "custom.node.title": "我的节点",
    },
  },
});
await setLocale("en-US");
```

Use semantic, namespaced keys with `t('custom.node.title')` directly in node metadata and field labels. User-entered node labels remain unchanged. Switching languages does not change document data.

Messages can also be registered after initialization — for example when a plugin or lazy chunk loads. `registerMessages` merges a whole catalog, `addMessages` merges one locale, and both re-render subscribed workbench components:

```ts
import { registerMessages } from "@flow-designer/i18n";

registerMessages({ "en-US": { "custom.node.title": "My node" } });
```

Supplied keys replace their previous values in that locale; unrelated keys remain. React components read translations through `useTranslate`, which subscribes to locale and catalog changes. The existing `@flow-designer/react` hook remains a compatible facade:

```tsx
import { useTranslate } from "@flow-designer/react";

function Toolbar() {
  const { t, locale, setLocale } = useTranslate();
  return (
    <button onClick={() => void setLocale(locale === "en-US" ? "zh-CN" : "en-US")}>
      {t("workbench.language.label")}
    </button>
  );
}
```

If node definitions call `t()` while their module is evaluated, initialize before importing/registering those definitions:

```ts
import { initializeDesignerI18n } from "@flow-designer/engine";
import { scenarioMessages } from "./i18n";

await initializeDesignerI18n(scenarioMessages);
await import("./register-nodes");
```

Every `createI18n()` service includes framework text automatically, maintained by domain under `packages/i18n/src/catalog/`. Applications only register their own text or explicit overrides; no per-package catalog assembly is needed. `initializeDesignerI18n` adds scenario messages and reads the initial browser preference (falling back to Chinese). Scenario catalogs, including example header text, belong in each scenario's `nodes/src/i18n.ts`. `createDesigner` owns the language-persistence subscription and disposes it on destruction or failed setup; registering messages alone does not write storage.

For a separately scoped React subtree, create and initialize a service explicitly:

```tsx
import { createI18n } from "@flow-designer/i18n";
import { I18nProvider, useTranslate } from "@flow-designer/i18n/react";

const translations = createI18n();
await translations.initializeI18n({ "en-US": { greeting: "Hello" } }, "en-US");
// Descendant useTranslate() calls use this service.
const view = (
  <I18nProvider instance={translations}>
    <MyWidget />
  </I18nProvider>
);
```

The service defaults to Chinese and performs no browser preference lookup or persistence. The complete designer still uses the shared default service: a Provider does not isolate its plugins or registries. This release does not establish same-page multi-designer isolation.

**Migration:** move translation functions and `Locale`/`Messages` types previously imported from `@flow-designer/model` to `@flow-designer/i18n`; model no longer re-exports them. Replace UI bootstrap calls to the low-level `initializeI18n` with `initializeDesignerI18n(scenarioMessages)` from engine. Low-level `initializeI18n` remains available for independent services, already includes framework text, and does not read browser preferences. `coreMessages` remains available from i18n and the engine facade for compatibility; the former per-package catalog exports are removed. Applications should register their own messages rather than re-registering the built-in catalog.

## Theme

The workbench ships light and dark appearances. The `plugin-theme` built-in adds a header toggle, persists the choice in browser storage, and switches the design tokens plus the antd algorithm without a reload. The theme is transient UI state: it never enters `Document.getData()` or the undo timeline.

Applications can read or change the theme from the model layer, or through the React hook:

```tsx
import { setTheme } from "@flow-designer/model";
import { useTheme } from "@flow-designer/react";

function ThemeButton() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>{theme}</button>;
}

setTheme("dark");
```

Component styles must consume the `--fd-*` tokens from `@flow-designer/react/style.css`; the dark palette is defined on `:root[data-fd-theme="dark"]`. An explicit `graphOptions.background` still wins over the theme for the canvas color.

## Example scenarios

| Scenario | Example capabilities                                    | Start command      |
| -------- | ------------------------------------------------------- | ------------------ |
| BPMN     | Process nodes, process content model, Sequence Flow     | `pnpm dev:bpmn`    |
| ComfyUI  | Typed data ports and workflow import/export transformer | `pnpm dev:comfyui` |
| ER       | Table, View, and Enum nodes with relation edges         | `pnpm dev:er`      |

Vite uses its default development port when running an individual app. E2E tests use ports `5179`, `5180`, and `5181`; start the three example apps in separate terminals before running the suite.

## Requirements

- Node.js `>=18.12.0`
- pnpm `9.x` (the repository pins `pnpm@9.15.9` through `packageManager`)

## Getting started

### Run an example from the workspace

```bash
git clone https://github.com/edsyang/flow-designer.git
cd flow-designer
pnpm install
pnpm dev:bpmn
```

To run another scenario:

```bash
pnpm dev:comfyui
pnpm dev:er
```

### Define a node in your application

The framework API is available from the `@flow-designer/engine` facade. The example below registers generic content and a node, then renders the workbench in an existing React/Vite application:

```tsx
import "@flow-designer/react/style.css";
import "@flow-designer/skeleton/style.css";
import "@flow-designer/plugins/style.css";
import { createRoot } from "react-dom/client";
import { BuiltinSetters, contentTypesRegistry, createDesigner, GenericContent, Workbench } from "@flow-designer/engine";
import { defineNode } from "@flow-designer/engine/definitions";

const mount = document.getElementById("root");
if (!mount) throw new Error("Missing #root element");

contentTypesRegistry.register(GenericContent);
const myNode = defineNode({
  meta: {
    name: "my-node",
    typeName: "MyNode",
    category: "basic",
    icon: "box",
  },
  view: {
    type: "node",
    shape: "fd-rect",
    defaultSize: { width: 200, height: 60 },
    ports: [
      { group: "in", position: "left" },
      { group: "out", position: "right" },
    ],
  },
  schema: [{ name: "name", type: "string", defaultValue: "" }],
  editor: [{ target: "name", description: "Name", setter: BuiltinSetters.String }],
});

const designer = await createDesigner({
  container: mount,
  documentType: "*",
  documentVersion: "1.0.0",
  nodeDefinitions: [myNode],
});

createRoot(mount).render(<Workbench engine={designer.engine} />);
```

External consumers must import the three published stylesheets shown above; JavaScript library imports do not automatically load their extracted CSS. Keep these imports in the application entry point.

This example requires React 18 and a JSX-capable build setup. Pass UI node bundles in `nodeDefinitions`; dynamic contributions use `designer.engine.registerNodeDefinition(bundle)`. Pure model consumers use `bundle.domain`. Content types and transformers belong to the intended registry set. See the [feature specification index](./.spec/README.md) for behavior and architecture details.

### Schema-only setter identifiers

Node definitions and other modules that only need built-in editor names should import the lightweight subpath:

```ts
import { BuiltinSetters, type BuiltinSetterName } from "@flow-designer/setters/constants";
```

This entry supports workspace source resolution, ESM, CommonJS and their declarations without loading editor components, React, Ant Design or model code. Identifier values are unchanged. It does not register editors: runtime composition still uses `registerBuiltinSetters` from the main package. Existing imports from `@flow-designer/setters` and the engine facade remain compatible. All four `create-node` presets generate the lightweight import.

## Repository layout

```text
packages/       Generic framework: model, core, graph, plugins, react, engine, etc.
apps/
  bpmn/         BPMN model, nodes, utilities, and app
  comfyui/      ComfyUI nodes, utilities, and app
  er/           ER nodes, utilities, and app
tools/
  create-node/  Node package scaffolding CLI
e2e/            Playwright end-to-end tests and manual diagnostics
.spec/          Feature- and behavior-oriented specifications
```

## Development and testing

```bash
pnpm install
pnpm format:check
pnpm lint
pnpm check:boundaries
pnpm typecheck
pnpm build
pnpm test
```

For focused package checks:

```bash
pnpm --filter @flow-designer/model test
pnpm --filter @flow-designer/model typecheck
```

Start the scenario apps required by E2E tests in separate terminals:

```bash
pnpm dev:e2e:bpmn
pnpm dev:e2e:comfyui
pnpm dev:e2e:er
```

Then run the Playwright E2E suite:

```bash
pnpm test:e2e
```

Some `e2e/*.mjs` files are manual diagnostic scripts and are not part of the Playwright test suite. Start the required example app(s) before running them.

## Contributing

Issues and pull requests are welcome. Before submitting a change, run tests and type checks for affected packages. Changes to cross-package APIs or serialized formats should also be checked against relevant scenario apps and specifications. GitHub Actions runs the format check, lint, import-boundary assertions, typecheck, workspace build, and Vitest unit tests on pushes and pull requests; the Playwright E2E suite is not a CI gate.

## Engineering guidance

See [AGENTS.md](./AGENTS.md) for contributor/agent constraints, the [verification guide](./docs/verification.md) for checks by change type, and the [E2E inventory](./e2e/README.md) for browser test setup and known concerns. Files in [docs/plans](./docs/plans/README.md) are historical context, not current execution instructions.

## UI contract import migration

Import `ISkeleton`, `IArea`, and `PaneConfig` from `@flow-designer/skeleton` instead of model. UI plugins acquire `getSkeleton(ctx.editor)` from skeleton; core Editor/PluginContext no longer own the UI. Engine binds and releases its skeleton automatically and retains the type exports through its facade. Standalone UI composition uses `bindSkeleton(editor, skeleton)` and its disposer; duplicate active bindings are rejected. React components continue using `useSkeleton()`.

## Graph contract import migration

Import `GraphPort`, canvas command contracts and connection decision types from `@flow-designer/core`. Import `IGraphManager`/`GraphAdapterPort`, `GraphOptions`, renderer configs and native event types from `@flow-designer/graph`; these former model exports are removed. Editor/plugin contexts expose the core application port. The engine facade continues aggregating the owning packages; native adapter APIs remain distinct from typed finalized edit subscriptions.

## License

This project is licensed under the [MIT License](./LICENSE).

Instance commands and notifications belong to `designer.editor`; document registries are available through `designer.document.getRegistries()`. See [the runtime migration guide](docs/core-runtime-migration.md) for ownership, disposal and the explicitly page-shared theme/locale policy.
