# Designer creation and plugin lifecycle

## Designer bootstrap

`createDesigner(options)` composes one runtime in this order:

1. Initialize the shared i18next instance with core messages and optional scenario `localeMessages`.
2. Configure MobX actions.
3. Construct `Engine`, which owns an `Editor`, `Skeleton`, and `PluginManager`. Record the optional container, acquire a disposable shared hotkey listener owner, and register option transformers with disposal handles.
4. Register built-in setters unless disabled.
5. Register enabled built-in plugins, passing graph options to the X6 graph plugin.
6. Register caller-supplied plugins and explicitly requested optional plugins such as autosave or the unsaved-changes prompt.
7. Construct the `Document` from the requested document type/version and settings.
8. Initialize the plugin manager and return the engine, editor, document, graph, plugin proxy, and `destroy()`.

Scenario registration (content types, node prototypes, edge types, and transformers) belongs in the scenario app before the runtime needs those registrations. Scenario translation catalogs are passed through `DesignerOptions.localeMessages`; the engine initializes the shared i18next instance without depending on scenario packages or schemas.

## Plugin manager contract

Plugins are created from a `PluginCreator` and receive a plugin context bound to the editor and manager. Registration records plugins by name. `init()` resolves declared plugin dependencies into an initialization sequence and reports missing dependencies as an invariant failure. Plugin implementations own their own disposal behavior.

The manager exposes plugin lookup, deletion, disabled-state changes, and a proxy for app-facing access. Deleting a plugin destroys it; engine destruction disposes the manager and clears the editor graph reference.

## Failure behavior to preserve or deliberately change

- Missing declared plugin dependencies fail the sequencing invariant before plugin initialization starts.
- If a plugin's `init()` fails, `PluginManager.init()` rejects and does not initialize later plugins. The failed plugin's `destroy()` is attempted to release partially allocated resources, and plugins initialized earlier in that sequence are destroyed in reverse order.
- If any setup step after engine construction rejects, including transformer registration, plugin registration, document construction or `plugins.init()`, `createDesigner()` destroys the partially initialized engine and propagates the original error. Cleanup errors are logged without replacing the setup error.
- Plugin replacement destroys and unregisters the existing instance before installing the replacement. `getAll()` returns a copy so callers cannot mutate the manager's internal registry.
- `createDesigner()` awaits registration and final initialization before returning the designer. Callers must not treat a returned instance as initialized before that promise resolves.

## Extension constraints

- Built-in plugins are composable; callers can disable selected built-ins and register additional plugins.
- Generic plugins must not assume a scenario's node or document schema.
- Keep initialization ordering explicit through plugin dependencies rather than incidental registration order.
- Ensure listeners, graph hooks, and UI resources are released during destruction.
- When a plugin is replaced or initialization fails, verify that partially allocated resources are released; a logged initialization error alone does not establish cleanup.

## Implementation and tests

Primary implementation: `packages/engine/src/create-designer.ts`, `packages/engine/src/engine.ts`, and `packages/core/src/plugins/`. Plugin sequencing and lifecycle behavior is tested under `packages/core/__tests__/plugin-manager.test.ts` and `packages/core/__tests__/sequencify.test.ts`; built-in integration behavior is tested under `packages/plugins/__tests__/`.

## Readiness phases and public options

**Current implementation:** resolving `createDesigner()` means plugin initialization has completed, not that the canvas is mounted. The X6 plugin installs a skeleton mount callback. Rendering `Workbench` invokes it, initializes the graph and bridges, then emits `graph:ready`. Install ready listeners before rendering. The returned `designer.graph` is a live getter, normally `null` at creation and reflecting `editor.getGraph()` after mount. The editor graph reference is observable so mounted controls can respond to readiness.

`documentType`, `documentVersion`, and `docSettings` take effect during document construction. `localeMessages` are merged with core translations during i18next initialization, before plugin initialization. `disableBuiltinSetters`, `disableBuiltinPlugins`, `plugins`, `autoSave`, and `unsavedPrompt` affect registration/initialization. `graphOptions` is passed to the graph plugin and applied when the canvas mounts. `autoSave` and `unsavedPrompt` are opt-in; autosave's default interval is 30 seconds.

`DesignerOptions.container` supplies the nullable live `PluginContext.container` and scopes keyboard commands; it does not mount React. If omitted, the React canvas records its owning workbench element when mounted. Apps own their React root. `DesignerOptions.transformers` registers format transformers before plugins initialize and releases those exact registrations on destruction or failed creation. The shared registry preserves first-registered format precedence; this does not establish per-editor transformer overrides.

## Resource ownership and known gaps

**Required contract:** the allocator owns cleanup on normal destruction, replacement, partial failure, and remount. A new subscription or resource must identify its disposer. Failed initialization must be observable without leaving an apparently ready instance.

**Known gaps from static inspection:**

- Canvas initialization happens later: the X6 plugin catches mount errors, emits `graph:init-failed`, and shows an error message. Such failure cannot reject an already-resolved `createDesigner()` promise; complete partial-mount rollback is not established.
- `hotkey.init(window)` returns an idempotent disposer. Listener acquisition is reference-counted per document. Built-in copy, delete, undo/redo and zoom shortcuts use disposable scoped bindings; input, textarea, select, editable descendants, IME composition and already-handled keyboard events are ignored.
- Engine destruction is idempotent and disposes plugins, clears graph/container references, destroys document resources, and runs acquired disposers even when another cleanup step fails. It does not unmount the caller's React root. Area mount hooks return an unregister function, and mounted callbacks may return a resource disposer. React panels release those resources in reverse order on unmount and roll back prior callbacks if a later callback throws. The graph plugin unregisters its hook when destroyed and releases graph/bridges/registry/history applier during unmount.
- Shared registries/signals/commands prevent claiming instance isolation; see the architecture spec.

Plugin-manager, engine and hotkey tests cover plugin-init rollback, registration failure cleanup, option transformer disposal, repeated destruction, input-safe scope and listener ownership. Changes to readiness or disposal need mount-failure and repeated create/mount/destroy checks, including absence of callbacks into a destroyed editor.
