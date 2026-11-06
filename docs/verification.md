# Verification guide and baseline

## Evidence status

This guide was established by source inspection on 2026-10-30 against `f3d3689`. Historical build/test counts in `docs/plans/` are not current pass evidence. A command that was not run is **not verified**, not passing or failing. Record the revision, command, result, and environment/setup limitations when updating this baseline.

The CI workflow runs the repository format check, package lint, the import-boundary assertions, typecheck, the workspace build, and the package tests serially. Package lint only scans `src/`, so test-file lint diagnostics are outside the gate, and the Playwright E2E suite is not a CI gate. Do not enable additional whole-repository gates until their baseline is measured and failures classified; do not disable individual checks simply to make a gate green.

## Checks by change type

| Change | Minimum relevant checks |
| --- | --- |
| Documentation only | Review diff, local links/paths, command names, and claims against implementation; no new runtime tests required |
| Lint/build/test configuration | Parse/load config, exercise positive and negative cases for new rules, compare affected checks before/after |
| Package-local behavior | Owning package's tests and typecheck; lint changed source; include relevant failure/cleanup cases |
| Public API / shared type / exports | Build owner and dependents; typecheck affected consumers; run affected tests and inspect generated declarations |
| Persistent model / history / transformers | Round-trip and undo/redo checks for values, IDs, endpoints and ports; run affected scenario tests |
| Graph / workbench interaction | Owning tests plus focused browser cases with explicit fixtures and readiness checks |
| Lifecycle / resources | Failure rollback and repeated create/mount/destroy; two editors if isolation is claimed |
| Library styles / packaging | Build output CSS and exported consumer path; smoke-check a consumer using built packages (source-mode Vite alone is insufficient) |
| Cross-cutting release work | Workspace build and serial package tests; additional checks appropriate to changed contracts |

Use `pnpm --filter <package-name> test`, `typecheck`, or `lint` for focused checks. Tests and typecheck may need built workspace dependencies: use `pnpm build` when necessary. Full CI parity commands are:

```sh
pnpm turbo run //#format:check
pnpm turbo run lint
pnpm check:boundaries
pnpm turbo run typecheck build test
```

The Playwright E2E suite (`pnpm test:e2e`) needs the app servers described in [the E2E inventory](../e2e/README.md) and is not a CI gate.

## Local runtime and model-performance verification (2026-10-30)

The modernization checks use Node 22.23.2. The existing Node 22.7.0 installation can run model tests, but graph/plugin tests encounter dependency loading limitations around ESM imports in the X6 dependency tree. Classify those startup failures as runtime/setup failures and rerun with the tested newer runtime; do not weaken or skip tests. This records a tested local runtime, not a new workspace-wide `engines` requirement.

Select your local Node 22.23.2 installation through your version manager (for example, `nvm use 22.23.2`), confirm `node --version`, then run the normal `pnpm` verification commands above. Built package consumers require rebuilding changed workspace dependencies before tests; source-mode tests alone do not verify distributed package assets.

History tests establish one checkpoint for nested asynchronous transactions, observable rejection, and undo recovery of already-applied partial changes. They do not establish atomic rollback. Overlapping asynchronous transactions share the outer transaction and must be serialized by callers when separate undo steps are required. History stores up to 100 full checkpoints by default; it is bounded snapshot history rather than delta storage, and memory cost still scales with document size and checkpoint count.

Focused checks cover immutable edge snapshots, branch/save/load dirty semantics, delayed props observers, selective position restoration, property-preserving paste, awaited removal hooks, and IndexedDB transaction completion/abort. Large-document browser measurements remain a separate verification responsibility; package test counts alone do not establish responsive rendering.

## Test quality and failure classification

- Establish fixture prerequisites explicitly. An empty loop over edges or a nonnegative edge count does not prove routing correctness.
- Assert externally meaningful behavior and data, not incidental private method calls. Update existing cases rather than adding implementation-mirroring tests.
- Wait for observable readiness/state, not only a fixed timeout or the presence of the canvas wrapper.
- Classify a failure as **introduced**, **reproduced baseline**, **environment/setup**, or **unclassified**. Static concerns remain **not reproduced** until executed.
- Record known failures with the exact test/command, evidence, affected contract, and removal condition. Do not blanket-skip a suite or hide errors.
- Completed reports state what ran, what did not, and remaining risks. No report from this document alone establishes an all-green workspace.

## Known static concerns

See [E2E inventory](../e2e/README.md) for stale fixture assumptions and weak assertions, [lifecycle spec](../.spec/runtime/engine-and-plugin-lifecycle.md) for partial-init/cleanup gaps, and [document spec](../.spec/model/document-and-serialization.md) for history and copy semantics. These concerns identify where follow-up verification is needed; they are not authorization to change behavior outside the current task.

## Measured governance-update checks (2026-10-30)

Against base `f3d3689` plus this governance change, using the existing local installation:

- `pnpm exec eslint packages/*/src --format json`: before and after both exit 1 with **2,546 errors and 72 warnings across 126 files**. Diagnostic file/line/column/rule/severity locations match; this change adds no diagnostic locations. One TypeScript-rendered type name differed in message formatting between runs. This is a measured shared-source lint baseline, not the full workspace lint result.
- `pnpm check:boundaries`: 34 positive/negative assertions cover all eight shared packages, scenario imports/subpaths/relative paths, core UI imports, React type-only imports, and the exact legacy React adapter exception. The script loads the repository ESLint configuration and tests its import rule without unrelated type-aware lint rules.
- New documentation links and `git diff --check` were checked. Historical plan links were not exhaustively repaired.
- Build, Vitest, full workspace typecheck/lint, and browser E2E were not run for this documentation/configuration change. Their current pass/fail baseline remains unverified.

The boundary assertion script is an available focused check, not a newly enabled CI gate. Existing lint debt must be classified/cleaned separately before promoting full lint to a required CI gate.

## Focused React-helper boundary migration checks (2026-10-30)

After the helper moved from core to skeleton, `pnpm check:boundaries` passes 38 assertions: core React runtime imports are rejected at every path, including the former exception, type-only imports remain allowed, and reverse UI re-exports are rejected. Core and skeleton targeted builds pass. Built ESM and CJS smoke checks establish that core no longer exports the four UI helpers or imports React runtime, while skeleton exports them and renders memo content with supplied props. A separate TypeScript consumer check confirms required prop types and forwardRef setter compatibility against generated declarations.

Focused suites pass: core 40 tests, skeleton 26 tests (including function/class/memo/forwardRef/element rendering, key/ref preservation and registered setter precedence), and react 20 tests. Their package typechecks pass, the new helper's ESLint check has no diagnostics, and the frozen/offline lockfile consistency check passes without dependency upgrades. These are focused migration results; the final full-workspace build, test and typecheck results must be reported separately.

## Canvas performance measurement (2026-10-30)

The model-backed BPMN fixture uses 100, 300 and 500 nodes with twice as many edges, a 1440×900 viewport, Node 22.23.2, and locally installed Chrome in headless mode. Start a BPMN development server on 5179 or a production preview on 5189, then run:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5189 PLAYWRIGHT_CHANNEL=chrome PERF_MODE=production pnpm exec playwright test -c playwright.performance.config.mjs
```

The fixture reports synchronous `Document.load`, two animation-frame delay, model-backed movement and undo, a 60-step pointer drag with animation-frame intervals, real middle-button scrolling, and zoom. The two-frame value does not establish that every asynchronous view has rendered. Passing runs retain JSON measurements under `test-results`; timings are single-run observations, not performance thresholds or a general FPS guarantee.

Before keeping model node references outside X6's deep-cloned cell data, one development run at 500 nodes/1,000 edges took 7.20 s to load and 10.4 s to undo before incremental refresh optimizations. After the reference and incremental restore changes, a production run before viewport culling measured 54/121/186 ms synchronous load and 38/15/20 ms undo at 100/300/500 nodes respectively. At 500 nodes, drag frame p95 was 33.4 ms and 23.8% of intervals exceeded 25 ms; the interaction target was therefore not yet met. An experimental presentation-only hide/show pass improved 500-node drag p95 to 16.8 ms, with 2.9% over 25 ms; this experiment is not the final implementation measurement.

Viewport culling is enabled by default at 300 nodes, with 300 screen pixels of overscan, and can be disabled with `graphOptions.viewportCulling: false`. It changes view presentation only. Edge bounds come from rendered paths; unknown bounds remain visible. X6's separate `virtual` option remains opt-in; its endpoint-only edge test can omit edges crossing the viewport when both endpoints are outside. Verify culling with the browser viewport suite and measure on the intended hardware and representative diagrams.

In the final production run with presentation culling, synchronous load at 100/300/500 nodes was 49.2/122.9/188.1 ms and undo was 8.2/12.3/14.0 ms. Drag frame p95 was 16.8/33.3/16.8 ms, with 1.4%/5.3%/4.4% of intervals above 25 ms. Three additional 300-node runs produced p95 values of 33.3, 16.8 and 16.8 ms, with 5.5%, 2.6% and 3.6% of intervals above 25 ms. After zoom-to-fit, measured drags actually moved the model node; p95 was 16.7–16.8 ms and no sampled interval exceeded 25 ms across those runs. The 500-node p95 meets 25 ms in this single run, while the 300-node result varies around that threshold; these observations do not guarantee smoothness across machines or diagrams. Raw samples from this local run were preserved in `/private/tmp/flow-designer-performance-final.json` and `/private/tmp/flow-designer-performance-300-repeat.json`; reruns produce their own `test-results` JSON artifacts.

## Final integrated verification — 2026-10-30

The final uncommitted worktree was verified with Node 22.23.2 and pnpm 9.15.9. These measurements supersede earlier unverified or intermediate results for the changed code; they do not rewrite the historical baseline above.

| Check | Executed result |
| --- | --- |
| `pnpm build` | **19/19 tasks successful**. |
| `pnpm -r --workspace-concurrency=1 test` | **384/384 tests passed**. |
| `pnpm -r --workspace-concurrency=1 typecheck` | **Exit 0** across the workspace. |
| `pnpm check:boundaries` | **34/34 assertions passed**. |
| `PLAYWRIGHT_CHANNEL=chrome pnpm exec playwright test --workers=1 --reporter=line,json` | **38/38 passed**, **0 skipped**, **0 unexpected**, **0 flaky**; 102.4 seconds. All three documented app servers were running on ports 5179/5180/5181, with the original 30-second per-test timeout. |
| Published CSS paths | `@flow-designer/react/style.css`, `@flow-designer/skeleton/style.css`, and `@flow-designer/plugins/style.css` resolve to nonempty built CSS. |
| Lockfile consistency | `pnpm install --lockfile-only --offline --ignore-scripts --frozen-lockfile` passed after aligning the engine peer entry with the already-locked Ant Design 6.5.2. No dependency version upgrade was required. |

The full browser collection includes the six large-document viewport-culling correctness cases and the four workbench keyboard/context-action cases. Earlier E2E failures were repaired by establishing missing model-edge fixtures, clearing selection before isolated hover checks, and sending the documented wheel modifier while measuring actual graph zoom. Assertions were not weakened and no cases were skipped. See the [E2E inventory](../e2e/README.md) for scope and the limitations of older diagnostic branches.

**Shared-source lint remains a failing check.** Existing lint debt has not been comprehensively cleared. Newly introduced diagnostics identified during review were corrected, but the intermediate aggregate was not rerun as a final clean lint result; no final diagnostic count or lint-pass claim is made here. Production performance samples are separate from E2E timing and are not inferred from a green test count.

## UI simplification and anchored-edge editing verification — 2026-10-30

This later verification covers removal of the automatic-layout capability and redundant UI counts, supported-operation hints, user-controlled narrow-viewport panels, and anchored edge-editing fixes. It is a separate measurement of the refined worktree; the earlier 384-test/38-case evidence above is retained as history.

| Check | Executed result for this refinement |
| --- | --- |
| `pnpm build` | **19/19 tasks successful**. |
| `pnpm -r --workspace-concurrency=1 test` | **385/385 tests passed across 14 test packages**. Included owning-package counts: graph **53**, plugins **44**, React **20**. |
| `pnpm -r --workspace-concurrency=1 typecheck` | **Passed** across the workspace. |
| `pnpm check:boundaries` | **34/34 assertions passed**. |
| Serial full Chrome E2E, using the official config and `PLAYWRIGHT_CHANNEL=chrome` | **39/39 passed**, **0 skipped**, **0 unexpected**, **0 flaky**; **103.3 seconds**. Report: `/private/tmp/flow-designer-refinement-e2e.json`. |
| Focused Chrome UI checks | **543px, 800px and 1440px passed**: counters absent, dock and hints inside the canvas without overlap, narrow panels reopenable, and inspector collapse retained after selection changes. |

The added `edge-edit-persistence.spec.ts` creates an explicit model-owned BPMN edge. It verifies that hover and a segment-handle click preserve routing, vertices and history; segment dragging retains the source/target ports and anchored endpoint positions; undo/redo restores manual vertices; moving the source node updates its anchor while preserving endpoints and manual edits; and `Document.getData()`/`load()` retains those edits. These are assertions for the executed fixture, not a claim that every scenario or external persistence format is covered. See the [E2E inventory](../e2e/README.md).

The final development-server samples on port 5179 used 100/300/500 nodes with twice as many edges:

| Nodes / edges | Synchronous load | Undo | Normal drag frame p95 | Normal drag intervals above 25ms | Fit-view drag frame p95 |
| --- | --: | --: | --: | --: | --: |
| 100 / 200 | 48.5ms | 13.3ms | 16.8ms | 2.67% | 16.7ms |
| 300 / 600 | 121.7ms | 16.5ms | 33.3ms | 5.45% | 16.7ms |
| 500 / 1000 | 185.2ms | 15.0ms | 33.3ms | 7.37% | 16.8ms |

These are development-mode observations, not a production before/after comparison or a guaranteed performance threshold. Normal-drag p95 exceeds 25ms at 300 and 500 nodes in these samples. Passing functional tests does not establish continuous 60 FPS for diagrams containing hundreds of nodes.

**Repository-wide lint remains unpassed because of existing debt and was not rerun in full during this refinement.** Focused clean checks do not establish a clean repository lint result. No claim that every verification gate is green is made.

## Core-boundary and edge-interaction integration — 2026-10-30

This later pass verifies the React-helper ownership migration, the lightweight setter-constants entry, and the refined edge-interaction contract. It preserves the earlier 384/385-test and 38/39-case measurements as history. Environment: Node 22.23.2, pnpm 9.15.9 and locally installed Chrome; this is a tested local runtime, not a new workspace-wide engines requirement.

| Check | Executed result for this pass |
| --- | --- |
| `pnpm build` | **19/19 tasks successful**. |
| `pnpm -r --workspace-concurrency=1 test` | **405/405 tests passed across 14 test packages**. Included counts: model **101**, create-node **27**, core **40**, graph **58**, setters **22**, skeleton **26**, react **20**, plugins **44**. |
| `pnpm -r --workspace-concurrency=1 typecheck` | **Passed** across the workspace. |
| `pnpm check:boundaries` | **38/38 assertions passed**, including rejection of React runtime imports at core's former exception path and rejection of reverse UI re-exports. |
| Serial full Chrome E2E, official config, `PLAYWRIGHT_CHANNEL=chrome` | **40/40 passed**, **0 skipped**, **0 unexpected**, **0 flaky**; **109.6 seconds**. All three documented app servers were available on 5179/5180/5181. Report: `/private/tmp/flow-designer-core-fix-e2e-final.json`. |
| Built core/skeleton consumers | Independent ESM and CJS checks establish that core no longer exports the four UI helpers or imports React runtime; skeleton exports them and renders memo content with supplied props. A generated-declaration TypeScript consumer preserves required prop types and accepts a forwardRef setter. |
| Lightweight constants consumers | `@flow-designer/setters/constants` passed independent ESM, require, NodeNext and source/build consumer checks without UI imports. Eighteen scenario node files and four create-node template variants use the lightweight entry; the original setters entry remains compatible. |
| Lockfile consistency | `pnpm install --lockfile-only --offline --ignore-scripts --frozen-lockfile` passed after removing core's React runtime peer. No dependency version upgrade was required. |

The first full browser attempt produced 38 passes and two failures because older SVG assertions read the `stroke` attribute while interaction styling now uses inline styles to survive X6 redraws. The assertions were changed to check the rendered computed stroke color; the focused three-case subset and then the full 40-case collection passed. This adapts the observation to the rendered result without relaxing the expected colors or omitting cases.

The current edge contract supersedes the earlier paragraph describing node movement as preserving manual bends. Hover and handle clicks preserve routing, bends and history; repeated segment drags retain orthogonal geometry without accumulating closed loops. The regression checks that the wide hit path stays transparent while the visible path reflects hover/selection and restores the caller's color and width. Moving an endpoint node clears manual bends. Only interchangeable directional ports—those without explicit ID, label or data type—may switch with relative node positions; semantic ports remain attached, and a configured validator can reject a proposed switch. The final position, port changes and cleared bends commit together, with undo restoring the prior geometry. Selection produces no floating action popup; scoped copy, paste, delete and undo shortcuts remain available. These results cover the executed fixtures, not every scenario or external format.

Latest development-server samples used 100/300/500 nodes with twice as many edges:

| Nodes / edges | Synchronous load | Undo | Normal drag frame p95 | Normal drag intervals above 25ms | Fit-view drag frame p95 |
| --- | --: | --: | --: | --: | --: |
| 100 / 200 | 49.0ms | 9.9ms | 16.8ms | 3.70% | 16.8ms |
| 300 / 600 | 119.3ms | 17.5ms | 33.2ms | 5.83% | 16.7ms |
| 500 / 1000 | 185.2ms | 14.9ms | 33.2ms | 5.15% | 16.8ms |

These are local development-mode observations, not production before/after measurements or a continuous 60 FPS guarantee. Normal-drag p95 remains above 25ms at 300 and 500 nodes. Functional pass counts and fast synchronous load/undo do not establish smoothness for every large diagram.

**Repository-wide lint still has existing debt and was not rerun in full in this pass.** The new helper's focused ESLint check is clean; this does not establish a clean repository lint gate. The helper import breaking change and engine aggregate compatibility are documented in [the migration note](core-ui-helper-migration.md); the remaining package-organization proposals are distinguished from implemented changes in [the package review](core-package-review.md).

## Modern workbench and viewport-interaction integration — 2026-10-30

This pass covers the graphic-card node library and floating work surfaces, modal operation help, graph-synchronized zoom slider, configured-node inspector reopening, pointer-local quick add, and the accompanying viewport/edge interaction changes. Earlier measurements above remain historical evidence. Runtime: Node **22.23.2**, pnpm **9.15.9**, and locally installed Chrome.

| Check | Executed result for this pass |
| --- | --- |
| `pnpm build` | **19/19 tasks successful**. Log: `/private/tmp/flow-designer-modern-build.log`. |
| `pnpm -r --workspace-concurrency=1 test` | **431/431 tests passed across 14 test packages**. Included owning-package counts: graph **80**, React **21**, plugins **47**. Log: `/private/tmp/flow-designer-modern-tests.log`. |
| `pnpm -r --workspace-concurrency=1 typecheck` | **Exit 0** across the workspace. Log: `/private/tmp/flow-designer-modern-types.log`. |
| `pnpm check:boundaries` | **38/38 assertions passed**. |
| Focused Chrome workbench E2E | **6/6 passed**: quick-add pointer/keyboard creation and selection; Escape/outside focus handling; mode and fixed-size dock controls; retained copy/paste/delete/undo behavior; modal Tab containment, Escape/backdrop dismissal and trigger focus restoration; slider scale synchronization and narrow-viewport property reopening. |
| Built CSS | Built React/plugins CSS includes the help, slider and card-library styles; package CSS exports remain available. |
| Full serial Chrome E2E | **50/50 expected cases passed**, **0 skipped**, **0 unexpected**, **0 flaky**; **127.843 seconds**. Official config with `PLAYWRIGHT_CHANNEL=chrome` and one worker. Report: `/private/tmp/flow-designer-modern-e2e.json`; log: `/private/tmp/flow-designer-modern-e2e.log`. |
| Production steady-state drag benchmarks | **3/3 graph sizes passed** for both the 300px long drag and 30px short drag; detailed measurements below. |

Visual checks at **543px, 800px and 1440px** show a real selected UserTask and its matching properties. At narrow width the collapsed library becomes a small floating button, and the complete dock fits within the viewport. Screenshots: `/private/tmp/flow-designer-modern-selected-543.png`, `/private/tmp/flow-designer-modern-selected-800.png`, `/private/tmp/flow-designer-modern-selected-1440.png`; help dialog: `/private/tmp/flow-designer-modern-help.png`.

The final production steady-state long-drag samples used 100/300/500 nodes with twice as many edges, retaining all 200/600/1000 edges. Routing failures and errors were **zero** for all three samples.

| Nodes / edges | Synchronous load | Final rendered-path stability | Undo | 300px drag frame p95 | Drag intervals above 25ms | Pan frame p95 | Wheel frame p95 | Fit-view drag frame p95 |
| --- | --: | --: | --: | --: | --: | --: | --: | --: |
| 100 / 200 | 53.7ms | 664.0ms | 27.9ms | 16.7ms | 1.64% | 16.7ms | 16.7ms | 16.7ms |
| 300 / 600 | 130.4ms | 2178.7ms | 36.9ms | 16.8ms | 1.67% | 16.7ms | 16.8ms | 16.7ms |
| 500 / 1000 | 207.4ms | 4747.3ms | 72.6ms | 16.8ms | 1.64% | 16.7ms | 16.7ms | 16.8ms |

The normal long-drag fixture produced **30 position events / 120 route computations**; fit-view dragging produced **60 events / 240 route computations**. These are the final steady-state production observations; earlier mixed initial-render profiling values are not used as final performance evidence. Initial stabilization of all rendered edge paths is distinct from synchronous model loading: at 500 nodes it took approximately **4.75 seconds**, so first rendering is not instantaneous. The measured frame percentiles do not guarantee continuous 60 FPS for every document or interaction.

The final **30px short-drag** samples also retained all 200/600/1000 edges with zero routing failures/errors:

| Nodes / edges | Short-drag frame p95 | Intervals above 25ms | Position events / route computations |
| ------------- | -------------------: | -------------------: | -----------------------------------: |
| 100 / 200     |               16.7ms |                1.67% |                               3 / 12 |
| 300 / 600     |               16.7ms |                   0% |                               3 / 12 |
| 500 / 1000    |               16.8ms |                1.64% |                               3 / 12 |

The six production artifacts are `/private/tmp/flow-prod-perf-final/{long,short}/{100,300,500}-nodes.json`; execution logs are `/private/tmp/flow-prod-final-long.log` and `/private/tmp/flow-prod-final-short.log`.

The final full-suite browser run and repeated **38/38** boundary assertions complete the recorded integration checks. Zero routing failures in these measured fixtures does not mean routing is infallible: the bounded search can fail in dense scenes or when endpoints are physically blocked, and such failures must remain observable through the established logger/error path. The initial all-path stabilization time and this routing limit remain relevant alongside steady-state frame results.

**Repository-wide lint remains unpassed.** The final scoped graph lint result is **0 errors and 18 warnings** (array-index assertions in `orthogonal-routing.ts`); the other new routing/safe-segment files have no diagnostics in that scoped result. Error events now reach the plugin logger without an algorithm change. The build, 431-test and typecheck results above were rerun after the final source adjustments. A scoped check with warnings does not establish a clean repository lint gate.

## Registration guards, boundary assertions, and lint budgets — 2026-11-04

This pass fixes the scenario node-registration guards, repairs the import-boundary script and runs it in CI, adds an explicit autosave restore entry point, aligns the CI documentation, and puts the remaining shared-package lint debt under a per-package warning budget. Earlier sections remain historical evidence. Runtime: Node **22.23.3**, pnpm **9.15.9**, Windows host with locally installed Chrome; the Playwright E2E suite was not executed in this pass (see below).

| Check | Executed result for this pass |
| --- | --- |
| `pnpm build` | **19/19 tasks successful**. |
| `pnpm -r --workspace-concurrency=1 test` | **462/462 tests passed across 14 test packages** (53 test files). Registration suites: bpmn 17, comfyui 15, er 12; plugins 55. |
| `pnpm turbo run typecheck` | **34/34 tasks successful** (exit 0). |
| `pnpm turbo run lint` | **19/19 tasks successful** (exit 0). Shared-package output is warnings only and sits exactly at each package's pinned budget. |
| `node scripts/check-boundaries.mjs` | **38/38 import-boundary assertions passed** (was failing with a ConfigError before the repair). |
| `pnpm exec prettier --check .` | **Exit 0** — all matched files use Prettier code style. |
| Playwright E2E | **Not run.** The sandboxed shell cannot spawn esbuild's config-loading service (`spawn EPERM`), so the development servers the suite needs could not be started here. No E2E claim is made for this pass. |

The boundary script read the core `no-restricted-imports` rule while `eslint.config.js` configures `@typescript-eslint/no-restricted-imports`, so the resolved configuration had an undefined severity and `Linter.verify` threw. The script now resolves whichever restricted-import rule the configuration defines and forwards the configured plugins; the workflow runs `pnpm check:boundaries` after lint. Import-boundary enforcement is therefore a CI gate from this pass on, while package lint only scans `src/` and the E2E suite remains outside CI.

Shared-package source lint reports **0 errors and 836 warnings across 61 files**; `no-explicit-any` (225) and `no-non-null-assertion` (92) account for the standalone diagnostics and the rest cascade from them. Promoting the two rules to errors would require 317 source edits, most of them rooted in model's `Setting<T = any>` and setter typing, so each package's lint script instead pins `--max-warnings` to its measured count (model 397, graph 212, plugins 114, core 47, skeleton 46, react 12, setters 8, engine 0). These are regression ceilings, not targets: a new warning fails the package, and the budget must be lowered when debt is removed rather than raised to admit new debt.

The scenario node registries inverted their guard, so each `registerXxxNodes()` call was a no-op on a fresh registry and the side effect happened inside `refreshXxxTranslations()`. The guards and call order are fixed, `refresh` no longer creates entries, and three node packages now cover the contract with a `registration.test.ts` that asserts the empty starting registry, full registration, idempotency and locale refresh.

`plugin-auto-save` gained explicit `restore()` and `clear()` exports backed by `loadFromIndexedDB`/`deleteFromIndexedDB`. Restore applies the stored snapshot through `Document.load()` and reports whether anything was applied; saving remains the only automatic IndexedDB interaction, and the contract is recorded in [the runtime spec](../.spec/runtime/engine-and-plugin-lifecycle.md).

## Theme, blank-drop connections, and Less authoring — 2026-11-05

This pass adds a light/dark theme with a header toggle, turns a connection drag that ends on empty canvas into a node picker that connects the new node automatically, moves every library stylesheet from CSS to Less, and polishes the workbench panels (inspector persistence, edge properties, overlaid node library, line-shaped grid). Earlier sections remain historical evidence. Runtime: Node **22.23.3**, pnpm **9.15.9**, Windows host with locally installed Chrome. The Playwright E2E suite was **not** executed in this pass; browser behaviour was checked with throwaway Playwright scripts against the production BPMN build served locally, and those scripts were deleted afterwards.

| Check | Executed result for this pass |
| --- | --- |
| `pnpm turbo run build --concurrency=1` | **19/19 tasks successful**. |
| Package tests (run per package) | **503 tests across 57 files passed**: model 112, graph 88, plugins 56, core 40, skeleton 40, react 28, create-node 27, setters 22, bpmn-model 20, engine 17, bpmn-nodes 17, comfyui-nodes 15, er-nodes 12, comfyui-utils 9. `bpmn-utils` and `er-utils` have no test files. |
| `pnpm turbo run typecheck --concurrency=1` | **34/34 tasks successful** (exit 0). |
| `pnpm turbo run lint` | **19/19 tasks successful** (exit 0); every package sits at or under its pinned warning budget. |
| `node scripts/check-boundaries.mjs` | **38/38 import-boundary assertions passed**. |
| `pnpm exec prettier --check .` | **Exit 0** — all matched files use Prettier code style. |
| Playwright E2E suite | **Not run** in this pass, per the maintainer's instruction to defer it. No E2E claim is made. |

The first serial workspace test run aborted in `@flow-designer/comfyui-nodes` with `FATAL ERROR: NewSpace::EnsureCurrentCapacity Allocation failed`, and one typecheck task exited 134; both are host memory exhaustion on this machine, not test failures. Re-running the affected packages one at a time passed (comfyui-nodes 15/15, er-nodes 12/12, bpmn-nodes 17/17, bpmn-model 20/20, comfyui-utils 9/9) and the serial typecheck then finished 34/34, so the counts above are from the per-package runs.

Browser checks against the production BPMN build confirmed: the header toggle switches `data-fd-theme`, `--fd-*` tokens, storage and the canvas background between light (`#ffffff` bodies, `rgb(247,248,250)` canvas) and dark (`#1d2432` bodies, `rgb(18,23,34)` canvas), with the grid switched to a mesh pattern; the node library is absolutely positioned and no longer displaces the canvas; a drag released on empty canvas keeps its temporary edge while the picker is open, hides the library, keeps the inspector, and creates plus connects the chosen prototype in one undo step; cancelling removes the temporary edge. Selecting a connection shows the localized "connection" heading in the inspector.

Graph lint dropped from 216 to **214** warnings while adding the palette code, so `packages/graph/package.json` pins the lower budget. Background recolouring goes through X6's scroller background (`scroller.drawBackground`), because X6 delegates `Graph.drawBackground` to the scroller whenever `options.background` is null; a direct `graph.options.background` assertion therefore reads null even though the colour is applied.

## Connection policy, bounded routing, and floating workbench — 2026-11-05

This pass separates physical port positions from connection capabilities. BPMN Start emits only, End receives only, and ordinary BPMN ports accept both directions without changing existing port IDs. Blank-drop menus use candidate metadata; committing validates real endpoints, semantic rules and routability. New connection names come from scenario defaults, while imported labels and explicit empty names remain intact. The inspector updates localized field labels without rewriting document data.

Canvas creation and connection operations now use shared typed commands. Failed creation compensates only owned objects; no-op transactions preserve redo and unrelated edits. The floating dock measures the visible panel corridor without moving the graph viewport. Theme changes preserve caller colors, and stale edge hover highlights are cleared with owned listener cleanup.

Orthogonal interaction admission uses signed port tangents, physical obstacles, no backtracking and at most three bends. A node move can evaluate interchangeable ports without mutating candidate endpoints, then commit the chosen pair once. Impossible new edits are rejected/restored with feedback. Loaded legacy documents are preserved: longer routes carry a warning, and impossible paths remain visibly diagnostic instead of silently disappearing. This compatibility path is not a claim that every imported route satisfies the new interaction constraints. Obstacle invalidation remembers blockers of competitive candidate paths, so removing or undoing an obstacle can restore the shorter route. Segment editing retains exact port anchors.

Browser fixture repairs preserve behavioral assertions: floating panels require a real hit-test before dragging; a collapsed inspector retains its toggle but hides its body; obstacle fixtures must actually intersect the path; port-tangent probes must sample within short terminal segments. Browser failures also exposed the stale-hover, port-anchor and obstacle-undo defects fixed above.

Final verification ran on macOS with Node 22.23.2, pnpm 9.15.9 and installed Chrome. After the final port-decision optimization, the results were:

| Gate                   | Result                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Workspace build        | 19/19 tasks; no TypeScript diagnostics                                                |
| Workspace unit tests   | 536/536 tests across 66 files                                                         |
| Typecheck and lint     | 53/53 tasks; graph warning budget lowered from 214 to 199, plugins from 114 to 104    |
| Full serial Chrome E2E | 71/71, zero skipped, unexpected or flaky cases; 147.7 seconds                         |
| Production performance | All six cases passed: 100/300/500 nodes with 200/600/1000 edges, 300px and 30px drags |

The production runs used the final BPMN build on port 5199, with no concurrent builds or browser tests. Every case asserts real node displacement and position events, retained edge count, zero routing failures and zero diagnostic errors. Long drags recorded 30 position events / 126 route computations; short drags recorded 3 / 18. The preceding pre-optimization development sample required 834–846 route computations for 30 events; this work-count comparison is not a cross-build timing benchmark.

| Nodes / edges | Sync load | All-path stability | Undo | Long drag P95 | Short drag P95 | Pan P95 | Wheel P95 | Fit drag P95 | Legacy warnings |
| --- | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| 100 / 200 | 121.9ms | 979.8ms | 24.5ms | 16.7ms | 16.7ms | 16.7ms | 16.8ms | 16.8ms | 101 |
| 300 / 600 | 318.5ms | 3130.6ms | 45.1ms | 16.7ms | 16.8ms | 16.7ms | 16.7ms | 16.7ms | 309 |
| 500 / 1000 | 518.9ms | 1710.7ms | 78.4ms | 16.8ms | 16.7ms | 16.8ms | 16.8ms | 16.7ms | 517 |

Long-drag intervals above 25ms were 1.61%, 1.64% and 1.59% respectively; pan and wheel samples recorded zero above 25ms. The loaded stress fixture contains old-style cross-row edges, so **101/309/517 legacy routing warnings remain observable**, with zero diagnostic errors. These samples verify responsiveness and retained edges in that legacy-load scenario, not universal compliance of those imported routes with the new three-bend admission rule. Strict new-interaction legality is verified separately by the connection and routing suites. Initial rendered-path stability took roughly 1–3.2 seconds in these samples; frame percentiles do not promise continuous 60 FPS for every graph or eliminate first-render cost.

Logs: `/private/tmp/flow-final4-{build,unit,static,e2e}.log`; browser report: `/private/tmp/flow-final4-e2e.json`; production artifacts: `/private/tmp/flow-final4-perf-{long,short}/**/performance.json`. Earlier failed integration attempts were retained separately; they are not passing evidence. No generated test artifacts are included in the worktree changes.

Final repository checks also passed: **38/38 import-boundary assertions**, whole-repository Prettier check, and `git diff --check`. Final source checksums remained unchanged throughout the last full E2E and production performance runs.

## Visible port routing and canvas workspace follow-up — 2026-11-05

The maintainer's three screenshots revealed gaps in the prior acceptance checks: a signed subpixel terminal was mathematically valid but visually hidden by the arrow, and fixed bottom-to-bottom ports could require four bends. The maintainer chose automatic interchangeable-port resolution rather than relaxing the three-bend limit. A valid requested pair is retained; otherwise eligible targets are tried while preserving the source, then eligible source alternatives. Capability and semantic failures never enter this fallback, and named/typed ports remain fixed. Native drops and shared creation commands persist the resolved IDs through undo/redo/load.

Bent routes now keep visible outward terminal segments (normally at least 12 graph units, compressed to a minimum of 4 in constrained gaps). Opposing close ports balance the shared lane. The BPMN default arrow can shrink only in presentation, leaving visible line behind it; custom marker definitions and serialized attrs remain unchanged. Browser assertions verify marker coordinate frames and tip alignment, not merely a sampled tangent. Temporary connection previews no longer produce legacy-document warnings. The swapped Chinese/English routing messages were corrected.

Sidebar is now inside canvasWorkspace without participating in canvas sizing. Dock centering follows sidebar visibility only. Inspector expansion does not shift the dock, and inspector maximum height reserves the measured dock strip plus a 12px gap; small-window content scrolls internally. Actual control hit tests cover narrow layouts. Connection names are inspector-only metadata; the canvas label editor plugin and export were removed, while property defaults, aliases, history and serialization remain supported. The generic graph label/custom-renderer API remains available.

Final checks for this follow-up: **542/542 unit tests across 65 files**, **79/79 Chrome browser cases** (zero skipped, unexpected or flaky; 159.9s), workspace build **19/19**, combined typecheck/lint **53/53**, and import boundaries **38/38**. Removed canvas-name-editor tests were replaced by inspector-only metadata and real double-click regressions; the generic label renderer was not removed. Graph warning budget fell from 199 to 192, plugins from 104 to 101.

Production checks used `/assets/index-DU0ikOfV.js` on port 5199 without concurrent builds or other browser runs. All six 100/300/500-node long/short cases passed actual displacement, retained-edge and routing-error assertions.

| Nodes / edges | Sync load | Final path stability | Long drag P95 | Short drag P95 | Pan P95 | Wheel P95 | Fit drag P95, first long run | Legacy warnings |
| --- | --: | --: | --: | --: | --: | --: | --: | --: |
| 100 / 200 | 123.6ms | 1004.2ms | 16.7ms | 16.7ms | 16.8ms | 16.7ms | 16.7ms | 101 |
| 300 / 600 | 318.5ms | 3238.7ms | 16.8ms | 16.8ms | 16.8ms | 16.8ms | 16.8ms | 309 |
| 500 / 1000 | 516.0ms | 1748.2ms | 16.8ms | 16.8ms | 16.7ms | 16.8ms | 33.3ms | 517 |

All samples retained 200/600/1000 edges with zero routing failures or diagnostic errors. Long drags produced 30 position events / 126 route computations, and fit-view drags 60 / 240. The initial 500-node fit-view sample had P95 **33.3ms**, with 6.17% of intervals over 25ms; the short-run comparison measured **16.8ms** (3.95% over 25ms), and one isolated repeat measured **16.7ms** (1.33% over 25ms). No code or thresholds changed between these runs. The first result is retained rather than replaced by the repeat: steady-state interaction is responsive in these samples, but occasional frame drops and initial rendering costs remain. Legacy warnings belong to the imported cross-row stress fixture; they do not establish that every imported edge satisfies the new short-route rule.

Reports: `/private/tmp/flow-six-{build,unit,static,e2e}.log`, `/private/tmp/flow-six-e2e.json`; performance artifacts under `/private/tmp/flow-six-perf-{long,short,500-repeat}/`. Visual review used `/private/tmp/flow-workspace-layout.png`, `/private/tmp/flow-diamond-stubs.png`, `/private/tmp/flow-start-left-stub.png`, and `/private/tmp/flow-bottom-auto-port.png`. Root visually checked all four, including the final bottom-port result without a warning toast.

## Independent i18n package verification (2026-11-06)

Scope: extract `@flow-designer/i18n`, separate its optional React adapter, relocate framework/scenario catalogues, migrate consumers, and move browser locale persistence to engine-owned cleanup. Full designer instances still share the default translation service; independent service/Provider isolation is verified separately.

- Workspace build: 20/20 tasks passed. Existing application chunk-size warnings remain; no TypeScript diagnostics.
- Workspace typecheck/lint: 56/56 tasks passed; new i18n package has zero warnings.
- Workspace tests: 555 tests passed. The first run exposed three React canvas tests relying on implicit model-owned catalogues; fixtures now explicitly register workbench and connection catalogues, with existing assertions retained.
- Focused Chrome E2E: 13/13 passed across BPMN, ComfyUI and ER. Includes locale persistence across reload, document/history invariance, selected connection translation and existing workbench layout/theme regressions. Bundled Chromium was unavailable; the initial launch attempt could not execute tests, so installed Chrome was used. Full unrelated E2E and performance suites were not rerun for this change.
- Built-package consumer smoke: ESM/CJS translation entry runs without DOM and with React loading forbidden; both React entry formats pass Provider/hook SSR; strict NodeNext `.mts`/`.cts` consumers compile.
- Service tests include dynamic/raw resource updates, independent instances, Provider unmount cleanup, initialization retry and pending-initialization resource replacement.
- Offline frozen-lockfile install passed after synchronizing workspace importers; no third-party dependency version changes. Import-boundary assertions: 46/46 passed. Changed files were formatted and `git diff --check` passed.

Local logs: `/tmp/flow-i18n-build.log`, `/tmp/flow-i18n-check.log`, `/tmp/flow-i18n-test.log`, `/tmp/flow-i18n-e2e.log`. Temporary built-package smoke consumers live outside the repository. Generated browser reports are not part of the change.

## Core refactor P0/P1 verification (2026-11-06)

Runtime baseline is `419757d`; P0 evidence and public-consumer/serialization fixtures were committed as `3ac9a61`. See `docs/plans/2026-11-06-core-baseline.md` and `pnpm check:core-baseline`.

P1 extracts GraphManager into type registry, cell projection, React rendering, presentation, connection coordination, interaction sessions, viewport and stencil resource owners. Public methods, route selection and persisted data remain unchanged. Initialization failure now cleans acquired resources while retaining the original error; disposal attempts all cleanup and reports failures after releasing remaining owners.

- Final workspace gate: 75/75 build/test/typecheck/lint tasks, 559 unit tests. Graph tests: 121, including four lifecycle cases. Graph lint budget lowered from 192 to 188.
- Full Chrome E2E after structural extraction: 82/82. After the final exceptional-cleanup change, focused workbench/port/edge interaction tests: 14/14. Full E2E was not repeated after that exceptional-path-only change.
- Built public consumer/serialization/scaffold check: six groups passed; import boundaries: 46/46.
- Production comparison after extraction: 100/300/500 nodes with 200/600/1000 edges, three runs each, 9/9 passed. Ordinary and fit drag P95 stayed about 16.7–16.8ms. Counts, route failures (0), error elements (0), legacy warnings (101/309/517), and local routing work (126 ordinary / 240 fit route passes) match the P0 fixture. This sampling preceded the final exceptional-cleanup guard and is not a universal frame-rate guarantee.
- Evidence: `/tmp/flow-core-p1-final-check.log`, `/tmp/flow-core-p1-e2e.log`, `/tmp/flow-core-p1-final-e2e.log`, `/tmp/flow-core-p1-performance/`, `/tmp/flow-core-p1-consumer.log`. Reports remain outside the repository.

## Unified built-in framework catalogs (2026-11-06)

Framework messages now live in i18n's internal catalog and are copied into every service. Applications register only scenario messages or explicit overrides; engine no longer gathers catalogs from UI packages. This supersedes the earlier catalog-ownership description, without changing browser persistence or claiming full designer instance isolation.

- Workspace build/test/typecheck/lint: 75/75 tasks passed, including 563 unit tests.
- Built-in catalog tests cover bilingual key/interpolation parity, frozen defaults, application override precedence, repeated initialization and isolation after native i18next resource writes.
- Import-boundary assertions: 50/50 passed, including catalog-to-UI/editor dependency rejection.
- Built consumer baseline: all six groups passed, retaining the explicitly characterized engine native-Node CSS limitation. Independent i18n ESM/CJS consumption also passed.
- Chrome targeted browser suite: 14/14 passed across language switching/reload in BPMN, ER and ComfyUI, edge-name inspector and workbench UI. Full browser and performance suites were not rerun for this catalog-only runtime change.

Logs: `/tmp/flow-i18n-unified-check.log`, `/tmp/flow-i18n-unified-consumer.log`, `/tmp/flow-i18n-unified-e2e.log`, `/private/tmp/flow-i18n-unified-boundaries.log`.

## P2a UI contract ownership (2026-11-06)

ISkeleton/IArea/PaneConfig now belong to skeleton; core Editor and PluginContext no longer hold UI. Engine owns an identity-bound skeleton binding, released after plugin cleanup. UI plugins retain the acquired skeleton and React uses its provider context.

- Build: 20/20 tasks passed. Subsequent test/typecheck/lint gate: 75/75 tasks passed (including build dependencies), 571 unit tests.
- Binding tests cover duplicate registration, independent editor keys, idempotent/old cleanup, rebinding, plugin cleanup after rebinding, initialization failure and cleanup failure. This validates UI binding ownership, not complete multi-designer isolation.
- Complete serial Chrome browser suite: 82/82 passed, with all three documented scenario servers running.
- Six built public consumer groups passed, including skeleton/engine UI type exports, removed model UI exports, headless core plugin initialization, and four generated packages. Existing engine native-Node CSS limitation remains explicitly characterized.
- Boundary checks: 50/50 passed; diff and changed-file formatting checks passed. Model lint budget lowered from 397 to 394; skeleton budget unchanged.
- Initial combined build+lint attempt failed because lint read declarations while build rewrote dist (React reported unresolved-type warnings). No rule or assertion was relaxed; the final run built first, then checked stable outputs.

Logs: `/tmp/flow-core-p2a-build.log`, `/tmp/flow-core-p2a-check-final.log`, `/tmp/flow-core-p2a-e2e.log`, `/tmp/flow-core-p2a-consumer.log`, `/tmp/flow-core-p2a-boundaries.log`. No routing/performance runtime changed, so performance sampling was not repeated. P2b graph/application contracts remain pending.
