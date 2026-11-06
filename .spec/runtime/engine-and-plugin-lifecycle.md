# Designer creation and plugin lifecycle

## Designer bootstrap

`createDesigner(options)` composes one runtime in this order:

1. Call `initializeDesignerI18n(localeMessages)` to add scenario messages to the built-in framework catalog in the shared default i18n service and initialize its first locale from browser storage (otherwise `zh-CN`).
2. Configure MobX actions.
3. Construct `Engine`, which owns an `Editor`, `Skeleton`, and `PluginManager`, and binds the UI in skeleton before plugin registration. Fork the bootstrap model catalog unless a caller-owned registry set is supplied. Acquire locale persistence, the page-shared browser theme owner and an independent scoped shortcut adapter with disposal handles. Register option transformers in the instance catalog.
4. Register built-in setters unless disabled.
5. Register enabled built-in plugins, passing graph options to the X6 graph plugin.
6. Register caller-supplied plugins and explicitly requested optional plugins such as autosave or the unsaved-changes prompt.
7. Construct the `Document` from the requested document type/version and settings.
8. Initialize the plugin manager and return the engine, editor, document, graph, plugin proxy, and `destroy()`.

Scenario registration (content types, node prototypes, edge types, and transformers) belongs in the scenario app before the runtime needs those registrations. Scenario translation catalogs are passed through `DesignerOptions.localeMessages`; the engine initializes the shared default translation service without depending on scenario packages or schemas. Applications evaluating translated metadata before creation call `initializeDesignerI18n(scenarioMessages)` before importing those definitions. The low-level `@flow-designer/i18n.initializeI18n` already includes framework text, but does not read browser preferences.

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

**Required contract:** translation catalogs are not frozen at initialization. `registerMessages(catalogByLocale)` merges a whole catalog and `addMessages(locale, messages)` merges one locale; both work before or after initialization and notify locale subscribers. Supplied same-locale keys replace previous values; unrelated keys remain. This corrects the former inaccurate “never replace” wording: pre-initialization object merging and post-initialization resource merging both permit explicit overrides, including lazy catalog corrections. It is not a relaxation of test expectations. React consumers read translations through `useTranslate` (locale plus catalog changes) rather than subscribing to the locale alone. Scenario apps must not register prototypes as a side effect of refreshing translations.

**Required contract:** autosave persists the last `Document.getData()` snapshot to browser IndexedDB but never restores it implicitly. Recovery is an explicit consumer step: `designer.plugins["plugin-auto-save"].restore()` loads the stored snapshot into the open document through `Document.load()`, resolves `false` when nothing was stored, and leaves the document untouched in that case; `clear()` deletes the snapshot. IndexedDB failures are logged and must not be reported as a successful save.

`DesignerOptions.container` supplies the nullable live `PluginContext.container` and scopes keyboard commands; it does not mount React. If omitted, the React canvas records its owning workbench element when mounted. Apps own their React root. `DesignerOptions.transformers` registers format transformers before plugins initialize and releases those exact registrations on destruction or failed creation. The instance registry uses latest-compatible registration precedence; disposal releases that exact override. Caller-supplied registry sets remain caller-owned.

## Resource ownership and known gaps

**Required contract:** the allocator owns cleanup on normal destruction, replacement, partial failure, and remount. A new subscription or resource must identify its disposer. Failed initialization must be observable without leaving an apparently ready instance.

**Known gaps from static inspection:**

- Canvas initialization happens later: the X6 plugin catches mount errors, emits `graph:init-failed`, and shows an error message. Such failure cannot reject an already-resolved `createDesigner()` promise; complete partial-mount rollback is not established.
- `hotkey.init(window)` returns an idempotent disposer. Listener acquisition is reference-counted per document. Built-in copy, delete, undo/redo and zoom shortcuts use disposable scoped bindings; input, textarea, select, editable descendants, IME composition and already-handled keyboard events are ignored.
- Engine destruction is idempotent and disposes plugins, clears graph/container references, destroys document resources, and runs acquired disposers even when another cleanup step fails. It does not unmount the caller's React root. Area mount hooks return an unregister function, and mounted callbacks may return a resource disposer. React panels release those resources in reverse order on unmount and roll back prior callbacks if a later callback throws. The graph plugin unregisters its hook when destroyed and releases graph/bridges/registry/history applier during unmount.
- Model catalogs, document signals, commands, notifications, shortcuts and business renderers are instance-owned. Theme and locale remain explicitly page-shared; setter/UI-definition separation is completed in P6.

Plugin-manager, engine and hotkey tests cover plugin-init rollback, registration failure cleanup, option transformer disposal, repeated destruction, input-safe scope and listener ownership. Changes to readiness or disposal need mount-failure and repeated create/mount/destroy checks, including absence of callbacks into a destroyed editor.

## Translation service lifecycle

The pure service lives in `@flow-designer/i18n`, with `createI18n()` for independent instances and convenience exports bound to `defaultI18n`. Initialization defaults to `zh-CN` unless its caller supplies a locale. It has no DOM, storage, React implementation or scenario dependency. Built-in framework text is maintained internally as pure dictionaries; no consuming package is imported. Locale/catalog subscribers receive a disposer; hooks subscribe to resource changes as well as language changes. `@flow-designer/i18n/react` supplies the optional `I18nProvider instance={service}` and `useTranslate`; `@flow-designer/react` retains its hook facade.

Every service starts with copies of all built-in framework messages from `packages/i18n/src/catalog/{graph,plugins,workbench,setters,skeleton}.ts`. Applications add only their own messages or explicit overrides; scenario header messages remain in each nodes package's `src/i18n.ts`. Engine no longer aggregates consumer catalogs or tracks first registration. `coreMessages` remains exported by i18n and engine for compatibility; the former consumer-package message exports are removed. Built-ins seed a service once: pre-init application registrations override them, initialization messages override earlier same-key registrations, and subsequent registrations override prior values without resetting unrelated keys or the selected language. Repeated initialization does not reinstall defaults or erase application overrides. `createDesigner` subscribes to actual locale changes for browser persistence, avoids storage writes on catalog-only changes, and disposes the subscription during destruction or failed setup. Calling the initializer alone does not install a persistence subscription. Storage is optional; failure must not prevent initialization.

The full designer still uses the shared default service, not a service passed through a Provider. Independent service/Provider isolation must not be described as complete multi-designer isolation. Translation API/type imports formerly obtained from model move to `@flow-designer/i18n`; model has no compatibility re-export.

## UI ownership cleanup

The engine's UI binding is its first acquired disposer and is released after plugin disposal, document cleanup and later-acquired disposers. UI plugins capture their bound skeleton when created; they remove contributions from that same object even if an external owner later unbinds/rebinds the editor. Failed initialization and failed plugin destruction still release the engine binding. Core has no skeleton ownership and can register, initialize and dispose non-UI plugins without any binding.

## Instance service ownership

Editor exposes its own commands, notifications and events. Command registration and signal subscriptions return identity-bound disposers. Shortcut handling is injected through a DOM-independent port; the browser implementation ignores inputs, IME and other workbench scopes, and disposes its own listeners. Notifications bind to the owning Workbench in an effect; unmounting it cannot redirect messages into another editor.

Document accepts explicit registries/signals or creates its own services. Engine and its Document use the same registry identity. Bootstrap catalogs are copied at construction, not live shared mutation channels. Registry replacement refreshes current definitions without adding overlays; cloning preserves property descriptors while separating owned data. Pending additions/removals cannot mutate a disposed document or remove a replacement object with the same ID.

DisposableScope cleans every owner in reverse order and reports CleanupError.errors. Engine and plugin-manager cleanup attempt all resources even after failures. Failed creation still reports its original setup error, with cleanup failures separately reported. The caller owns its React root.
