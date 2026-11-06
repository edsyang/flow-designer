# Architecture and package boundaries

## Purpose

Flow Designer is a reusable visual editor framework with scenario applications. The framework owns generic document state, editor orchestration, graph rendering, reusable UI, and extension mechanisms. BPMN, ComfyUI, and ER behavior belongs to their respective scenario packages.

## Layers

- `packages/i18n`: translation service, locale/resource subscriptions and independently created instances; optional React integration is exposed only through `/react`. The service does not import UI, model, browser storage or application catalogs.
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

Document catalogs/signals, editor commands/notifications, scoped shortcuts and business renderer registrations are instance-owned. Two independently configured editors are verified with same-name types and IDs, focused shortcuts and destruction of one while the other remains usable. Theme and locale are explicitly page-shared preferences. Setter/UI contribution ownership is addressed separately in P6; this guarantee does not isolate arbitrary application globals or explicit page-global native X6 extensions.

## Translation ownership and migration

`@flow-designer/i18n` exposes `defaultI18n` and its convenience functions, plus `createI18n()` for independent resource/locale ownership. `@flow-designer/i18n/react` exposes `I18nProvider` (`instance` prop) and `useTranslate`; the existing React package hook delegates to this adapter. Model no longer exports translation APIs or types: migrate those imports to the i18n package, without a reverse compatibility dependency.

Framework text is unified in `packages/i18n/src/catalog/`, with separate pure dictionary files for graph, plugins, react, setters and skeleton domains. Every `createI18n()` instance starts with independent copies of these built-ins; the service imports no consuming packages. Applications register only their own text or explicit overrides. Example scenario catalogs, including header text, remain in their nodes package's `src/i18n.ts`. Engine selects the initial browser locale and adds scenario messages through `initializeDesignerI18n(scenarioMessages)`; it no longer aggregates five package exports or maintains a catalog-registration flag. Low-level initialization also includes built-ins, but does not read browser preferences. Definitions translating metadata during module evaluation must be imported after initialization. `coreMessages` is exported from i18n and retained through engine for compatibility; individual consumer-package catalog exports are removed.

The complete designer still uses the shared default service. An independent service with a Provider isolates translations in its consuming subtree, not the designer's plugin/runtime services.

## UI contracts and editor bindings

`ISkeleton`, `IArea` and `PaneConfig` are exported by `@flow-designer/skeleton`, not model. Pane content retains the same string/React element/component contract. Core Editor and PluginContext have no skeleton property or get/set API, and a core PluginManager can operate without a UI.

Engine binds its editor to its skeleton through `bindSkeleton(editor, skeleton)` before plugins are registered. UI plugins use `getSkeleton(ctx.editor)` from skeleton and retain that acquired object for their lifetime; React components use their provider's `useSkeleton` hook. Active duplicate bindings are rejected, even for the same object. The binding disposer is idempotent and identity-checked; after cleanup a new binding is permitted, and an old disposer cannot remove it. Engine disposes plugins before releasing its binding, including cleanup failure paths. The engine facade continues exporting the UI types through its skeleton aggregation; direct model type imports must migrate. No reverse model/core re-export is provided.

## Application graph ports and adapter contracts

Core exports `GraphPort`, composed from projection, selection, viewport, interaction-mode, connection-decision and subscription capabilities. Its configs and finalized edit/application notifications contain data rather than X6 cells, DOM events or React renderers. Editor and PluginContext expose this application port. Canvas command names/request/results and connection Context/Validator/Result/Reason types are also core contracts; implementations stay in plugins. PortDefinition and canUsePort remain model-owned.

Graph exports `GraphAdapterPort` and its compatibility alias `IGraphManager`. Native events, renderer registration/configuration, GraphOptions, GraphData, stencil/Dnd, X6 plugin and debug access belong to this adapter, not core. The engine facade aggregates the new owning packages; direct imports formerly obtained from model must migrate to core or graph, without a reverse compatibility re-export. UI querying application state uses the core port; explicit renderer/stencil configuration uses the graph adapter through the owning graph plugin.
