# Architecture and package boundaries

## Purpose

Flow Designer is a reusable visual editor framework with scenario applications. The framework owns generic document state, editor orchestration, graph rendering, reusable UI, and extension mechanisms. BPMN, ComfyUI, and ER behavior belongs to their respective scenario packages.

## Layers

- `packages/model`: document/content state, node prototypes, settings, registries, and serialization contracts.
- `packages/core`: editor orchestration, commands, plugin lifecycle, and editor-level communication.
- `packages/graph`: graph-facing contracts and X6-backed graph management.
- `packages/plugins`: composable built-in editor capabilities built on framework APIs.
- `packages/skeleton` and `packages/react`: layout extension points and React workbench integration.
- `packages/setters`: reusable value editors registered for property schemas.
- `packages/engine`: ergonomic runtime facade and `createDesigner` composition.
- `apps/<scenario>/{model,nodes,utils,app}`: scenario-owned data models, node definitions, adapters, and runnable demos.
- `tools/create-node`: package and node scaffolding templates.

## Dependency rules

1. The shared framework must not import scenario packages or encode their domain types.
2. Scenario packages may depend on framework contracts; scenario apps compose the framework and scenario packages.
3. Keep graph rendering details behind graph APIs and plugin integration points.
4. `@flow-designer/engine` remains the convenient stable facade. Lower-level packages remain independently importable.
5. Cross-package changes to serialized data, node definitions, plugin APIs, or graph contracts require checking their consumers.

## Change verification

Use focused package checks first. For shared contracts, also validate dependent scenario packages and their adapters or integration tests. See [Document model and serialization](../model/document-and-serialization.md), [Designer creation and plugin lifecycle](../runtime/engine-and-plugin-lifecycle.md), and the relevant scenario specification.

## Enforcement and React adapter ownership

`eslint.config.js` restricts shared-package static imports of scenario packages (including their subpaths and relative imports into `apps/`). Core additionally rejects UI-layer imports and React runtime imports while allowing React type-only imports. Existing X6/UI-library restrictions remain in effect.

React content helpers (`createContent`, `isReactComponent`, `isReactClass`, `acceptsRef`) live in `packages/skeleton/src/create-content.ts` and are exported from `@flow-designer/skeleton`. The workbench panels and settings panel share this implementation. Core has no React runtime dependency or lint exception and no longer exports these helpers; direct core consumers must update their imports. The engine facade still obtains the same helper names through its skeleton re-export. Core must not re-export skeleton or react to preserve an old helper import, since that would reverse the dependency direction and introduce a cycle. See [the migration note](../../docs/core-ui-helper-migration.md).

Static import rules do not establish transitive dependency isolation or detect domain policy encoded without imports.

## Instance support boundary

The examples initialize one designer per page. Prototype/content/setter registries, signals, command registration, and hotkeys include shared state; isolated same-page multi-instance behavior has not been established. This is a current support limitation, not a decision to prohibit future multi-instance support. Any change claiming isolation must verify two independently configured editors, focus/shortcut dispatch, and destruction of one while the other remains usable.
