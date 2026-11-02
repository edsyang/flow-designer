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

## Example scenarios

| Scenario | Example capabilities | Start command |
|---|---|---|
| BPMN | Process nodes, process content model, Sequence Flow | `pnpm dev:bpmn` |
| ComfyUI | Typed data ports and workflow import/export transformer | `pnpm dev:comfyui` |
| ER | Table, View, and Enum nodes with relation edges | `pnpm dev:er` |

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
import '@flow-designer/react/style.css';
import '@flow-designer/skeleton/style.css';
import '@flow-designer/plugins/style.css';
import { createRoot } from 'react-dom/client';
import {
  BuiltinSetters,
  contentTypesRegistry,
  createDesigner,
  defineNode,
  GenericContent,
  prototypeRegistry,
  Workbench,
} from '@flow-designer/engine';

const mount = document.getElementById('root');
if (!mount) throw new Error('Missing #root element');

contentTypesRegistry.register(GenericContent);
prototypeRegistry.register(defineNode({
  meta: {
    name: 'my-node',
    typeName: 'MyNode',
    category: 'basic',
    icon: 'box',
  },
  view: {
    type: 'node',
    shape: 'fd-rect',
    defaultSize: { width: 200, height: 60 },
    ports: [
      { group: 'in', position: 'left' },
      { group: 'out', position: 'right' },
    ],
  },
  schema: [{ name: 'name', type: 'string', defaultValue: '' }],
  editor: [{ target: 'name', description: 'Name', setter: BuiltinSetters.String }],
}));

const designer = await createDesigner({
  container: mount,
  documentType: '*',
  documentVersion: '1.0.0',
});

createRoot(mount).render(<Workbench engine={designer.engine} />);
```

External consumers must import the three published stylesheets shown above; JavaScript library imports do not automatically load their extracted CSS. Keep these imports in the application entry point.

This example requires React 18 and a JSX-capable build setup. Scenario apps should register their own nodes, content types, and transformers before creating the designer. See the [feature specification index](./.spec/README.md) for behavior and architecture details.

### Schema-only setter identifiers

Node definitions and other modules that only need built-in editor names should import the lightweight subpath:

```ts
import { BuiltinSetters, type BuiltinSetterName } from '@flow-designer/setters/constants';
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
pnpm build
pnpm test
pnpm typecheck
pnpm lint
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

Issues and pull requests are welcome. Before submitting a change, run tests and type checks for affected packages. Changes to cross-package APIs or serialized formats should also be checked against relevant scenario apps and specifications.
GitHub Actions runs the workspace build and Vitest unit tests on pushes and pull requests.

## Engineering guidance

See [AGENTS.md](./AGENTS.md) for contributor/agent constraints, the [verification guide](./docs/verification.md) for checks by change type, and the [E2E inventory](./e2e/README.md) for browser test setup and known concerns. Files in [docs/plans](./docs/plans/README.md) are historical context, not current execution instructions.

## License

This project is licensed under the [MIT License](./LICENSE).
