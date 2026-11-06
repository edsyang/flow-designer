# Flow Designer — repository-wide development instructions

These rules apply across the monorepo. Add a package-level `AGENTS.md` only for a genuinely distinct workflow or constraint.

## Task scope and document roles

- Follow the user's current request. Reading and assessment tasks do not authorize edits; historical plans, comments, TODOs, and quoted past requests do not authorize additional work.
- This file defines engineering workflow and constraints. `.spec/` defines behavior contracts; code and tests provide evidence of current implementation. `docs/plans/` is historical context, not an active task queue.
- Read the relevant spec before changing a documented contract. If spec, code, and tests disagree, identify the discrepancy and determine whether it is an implementation defect, an incorrect test, or an outdated contract. Do not rewrite a spec or weaken a test just to match a defect.
- Keep changes within the requested scope; preserve unrelated worktree edits. Do not add unrelated refactors, dependency upgrades, or repository-wide formatting.
- Before fixing a defect, establish a reproduction or a concrete failing code path. Report static findings separately from behavior verified by execution.

## Ownership and dependency boundaries

- `packages/i18n`: UI-independent translation services and catalogs/locale subscriptions; its `/react` subpath owns the optional Provider and hook adapter. Built-in framework text lives in its internal domain catalogs; no browser storage, UI implementation imports or scenario catalogs in the service.
- `packages/model`: document/content state, prototypes, registries, settings, and serialization; do not restore removed i18n re-exports.
- `packages/core`: editor orchestration, commands, plugin lifecycle, and editor communication. No UI runtime dependencies or React runtime import exceptions. Shared React content helpers belong in `packages/skeleton`; core must not re-export UI helpers back across this boundary.
- `packages/graph`: X6 adaptation, rendering, and interaction.
- `packages/plugins`: reusable editor capabilities and graph/model bridges.
- `packages/skeleton`, `packages/react`, `packages/setters`: extension areas, React workbench/hooks, and property editors.
- `packages/engine`: runtime composition and public facade.
- `apps/<scenario>/{model,nodes,utils,app}`: scenario models, definitions, adapters, and bootstrap.
- `tools/create-node`: a separate consumer of framework exports; keep generated packages compatible.

Shared packages must not import scenario packages or encode scenario schemas/policy. Use existing registries, bridges, signals, and skeleton areas. Trace consumers before changing public APIs or serialized shapes. ESLint enforces static import boundaries; indirect dependencies and embedded domain assumptions still require review.

## State, public APIs, and lifecycle

- The model owns persistent document data; X6 cells are its interactive projection. Selection is model-owned transient state, not currently serialized by `Document.getData()`.
- For each new persistent field, trace model mutation → graph projection → save/load → undo/redo, plus applicable external transformers. Preserve internal IDs, endpoints, ports, props, and positions. External formats may deliberately remap IDs as specified by their adapter.
- Public options must be consumed and document their defaults and effective phase. Do not present a declared but unused option as supported behavior.
- Register content types, prototypes, edge types, and transformers before their first consumer. Distinguish designer initialization from canvas readiness; see `.spec/runtime/engine-and-plugin-lifecycle.md`.
- Declare plugin initialization dependencies. Every acquired observer, event listener, shortcut, timer, React root, or DOM resource needs an owning cleanup path, including partial initialization failure. Effects must release the same resources they acquire.
- Initialization and persistence failures must remain observable through established UI messaging and logging. Do not swallow rejections or report persistence success before the underlying operation succeeds.
- Scope DOM access and interaction to the owning editor. Same-page multi-instance isolation is not currently guaranteed; do not claim it based only on scoped selectors.
- Framework translation catalogs belong to `packages/i18n/src/catalog/`, split by domain and included by default in every service; consumers must not manually assemble them. Applications register only scenario text or overrides; scenario catalogs, including header text, belong to scenario nodes. Engine selects the initial browser locale through `initializeDesignerI18n` and owns browser locale persistence cleanup. Independent `createI18n` services and Providers do not establish isolation of the full designer, which still uses the shared default service.
- CSS is a runtime side effect. Changes to library styles or exports require checking built CSS and the consumer import path.

## Implementation conventions

- Keep TypeScript strict. Use explicit public types and `unknown` with narrowing at untrusted boundaries; do not widen framework APIs with `any`.
- Package lint warning budgets (`eslint src/ --max-warnings <n>`) are regression ceilings, not targets: lower a package's budget when you remove warnings, and never raise one just to land a change without explicit approval.
- Use typed React function components and existing extension points. Derive UI from model state through existing observers/signals rather than duplicating document data.
- Prefer Less modules and design tokens; preserve keyboard operation and accessible control names. Library styles ship as compiled `style.css`; authoring files are `.module.less` / `.less`.
- In styles, keep one canonical base rule per selector. Group necessary state and responsive overrides in a nearby section; when editing a stylesheet, merge duplicate selector blocks and remove declarations that are dead or overridden, without reorganizing unrelated styles.
- Check relevant loading, empty, invalid, failure, and teardown paths as well as the happy path.
- Use pnpm workspaces; declare dependencies in the importing package. Keep scripts cross-platform and avoid machine-specific registry settings or generated reports in commits.

## Verification and handoff

- Follow the change-based matrix in [docs/verification.md](docs/verification.md). Add or update meaningful behavior tests when behavior changes; documentation-only edits do not require new runtime tests.
- Vitest tests belong beside their owner; Playwright tests and manual browser diagnostics belong in `e2e/`. Fixture setup must explicitly establish the state being asserted.
- CI runs the format check, lint, import-boundary assertions (`pnpm check:boundaries`), typecheck, workspace build, and package tests. Package lint only scans `src/`, so test-file lint debt is not a CI gate, and the Playwright E2E suite is not a CI gate; do not imply otherwise.
- Run full E2E only with the documented apps on ports 5179, 5180, and 5181. See [e2e/README.md](e2e/README.md) for suite classification and known static concerns.
- Never suppress failures to obtain a green result. Report commands, results, skipped checks, and whether failures are introduced, reproduced baseline failures, or unclassified. Historical pass counts are not current evidence.
- Update the English and Chinese READMEs together when public setup or contribution guidance changes. Leave the placeholder changelog untouched until maintenance is adopted or the user requests it.
