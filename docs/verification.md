# Verification guide and baseline

## Evidence status

This guide was established by source inspection on 2026-10-30 against `f3d3689`. Historical build/test counts in `docs/plans/` are not current pass evidence. A command that was not run is **not verified**, not passing or failing. Record the revision, command, result, and environment/setup limitations when updating this baseline.

The CI workflow currently builds the workspace and runs package tests serially. Typecheck, lint, and E2E are not CI gates. Do not enable additional whole-repository gates until their baseline is measured and failures classified; do not disable individual checks simply to make a gate green.

## Checks by change type

| Change | Minimum relevant checks |
|---|---|
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
pnpm build
pnpm -r --workspace-concurrency=1 test
```

Full optional checks are `pnpm typecheck`, `pnpm lint`, and `pnpm test:e2e`. The latter requires the app servers described in [the E2E inventory](../e2e/README.md).

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
|---|---|
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
|---|---|
| `pnpm build` | **19/19 tasks successful**. |
| `pnpm -r --workspace-concurrency=1 test` | **385/385 tests passed across 14 test packages**. Included owning-package counts: graph **53**, plugins **44**, React **20**. |
| `pnpm -r --workspace-concurrency=1 typecheck` | **Passed** across the workspace. |
| `pnpm check:boundaries` | **34/34 assertions passed**. |
| Serial full Chrome E2E, using the official config and `PLAYWRIGHT_CHANNEL=chrome` | **39/39 passed**, **0 skipped**, **0 unexpected**, **0 flaky**; **103.3 seconds**. Report: `/private/tmp/flow-designer-refinement-e2e.json`. |
| Focused Chrome UI checks | **543px, 800px and 1440px passed**: counters absent, dock and hints inside the canvas without overlap, narrow panels reopenable, and inspector collapse retained after selection changes. |

The added `edge-edit-persistence.spec.ts` creates an explicit model-owned BPMN edge. It verifies that hover and a segment-handle click preserve routing, vertices and history; segment dragging retains the source/target ports and anchored endpoint positions; undo/redo restores manual vertices; moving the source node updates its anchor while preserving endpoints and manual edits; and `Document.getData()`/`load()` retains those edits. These are assertions for the executed fixture, not a claim that every scenario or external persistence format is covered. See the [E2E inventory](../e2e/README.md).

The final development-server samples on port 5179 used 100/300/500 nodes with twice as many edges:

| Nodes / edges | Synchronous load | Undo | Normal drag frame p95 | Normal drag intervals above 25ms | Fit-view drag frame p95 |
|---|---:|---:|---:|---:|---:|
| 100 / 200 | 48.5ms | 13.3ms | 16.8ms | 2.67% | 16.7ms |
| 300 / 600 | 121.7ms | 16.5ms | 33.3ms | 5.45% | 16.7ms |
| 500 / 1000 | 185.2ms | 15.0ms | 33.3ms | 7.37% | 16.8ms |

These are development-mode observations, not a production before/after comparison or a guaranteed performance threshold. Normal-drag p95 exceeds 25ms at 300 and 500 nodes in these samples. Passing functional tests does not establish continuous 60 FPS for diagrams containing hundreds of nodes.

**Repository-wide lint remains unpassed because of existing debt and was not rerun in full during this refinement.** Focused clean checks do not establish a clean repository lint result. No claim that every verification gate is green is made.

## Core-boundary and edge-interaction integration — 2026-10-30

This later pass verifies the React-helper ownership migration, the lightweight setter-constants entry, and the refined edge-interaction contract. It preserves the earlier 384/385-test and 38/39-case measurements as history. Environment: Node 22.23.2, pnpm 9.15.9 and locally installed Chrome; this is a tested local runtime, not a new workspace-wide engines requirement.

| Check | Executed result for this pass |
|---|---|
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
|---|---:|---:|---:|---:|---:|
| 100 / 200 | 49.0ms | 9.9ms | 16.8ms | 3.70% | 16.8ms |
| 300 / 600 | 119.3ms | 17.5ms | 33.2ms | 5.83% | 16.7ms |
| 500 / 1000 | 185.2ms | 14.9ms | 33.2ms | 5.15% | 16.8ms |

These are local development-mode observations, not production before/after measurements or a continuous 60 FPS guarantee. Normal-drag p95 remains above 25ms at 300 and 500 nodes. Functional pass counts and fast synchronous load/undo do not establish smoothness for every large diagram.

**Repository-wide lint still has existing debt and was not rerun in full in this pass.** The new helper's focused ESLint check is clean; this does not establish a clean repository lint gate. The helper import breaking change and engine aggregate compatibility are documented in [the migration note](core-ui-helper-migration.md); the remaining package-organization proposals are distinguished from implemented changes in [the package review](core-package-review.md).

## Modern workbench and viewport-interaction integration — 2026-10-30

This pass covers the graphic-card node library and floating work surfaces, modal operation help, graph-synchronized zoom slider, configured-node inspector reopening, pointer-local quick add, and the accompanying viewport/edge interaction changes. Earlier measurements above remain historical evidence. Runtime: Node **22.23.2**, pnpm **9.15.9**, and locally installed Chrome.

| Check | Executed result for this pass |
|---|---|
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
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 100 / 200 | 53.7ms | 664.0ms | 27.9ms | 16.7ms | 1.64% | 16.7ms | 16.7ms | 16.7ms |
| 300 / 600 | 130.4ms | 2178.7ms | 36.9ms | 16.8ms | 1.67% | 16.7ms | 16.8ms | 16.7ms |
| 500 / 1000 | 207.4ms | 4747.3ms | 72.6ms | 16.8ms | 1.64% | 16.7ms | 16.7ms | 16.8ms |

The normal long-drag fixture produced **30 position events / 120 route computations**; fit-view dragging produced **60 events / 240 route computations**. These are the final steady-state production observations; earlier mixed initial-render profiling values are not used as final performance evidence. Initial stabilization of all rendered edge paths is distinct from synchronous model loading: at 500 nodes it took approximately **4.75 seconds**, so first rendering is not instantaneous. The measured frame percentiles do not guarantee continuous 60 FPS for every document or interaction.

The final **30px short-drag** samples also retained all 200/600/1000 edges with zero routing failures/errors:

| Nodes / edges | Short-drag frame p95 | Intervals above 25ms | Position events / route computations |
|---|---:|---:|---:|
| 100 / 200 | 16.7ms | 1.67% | 3 / 12 |
| 300 / 600 | 16.7ms | 0% | 3 / 12 |
| 500 / 1000 | 16.8ms | 1.64% | 3 / 12 |

The six production artifacts are `/private/tmp/flow-prod-perf-final/{long,short}/{100,300,500}-nodes.json`; execution logs are `/private/tmp/flow-prod-final-long.log` and `/private/tmp/flow-prod-final-short.log`.

The final full-suite browser run and repeated **38/38** boundary assertions complete the recorded integration checks. Zero routing failures in these measured fixtures does not mean routing is infallible: the bounded search can fail in dense scenes or when endpoints are physically blocked, and such failures must remain observable through the established logger/error path. The initial all-path stabilization time and this routing limit remain relevant alongside steady-state frame results.

**Repository-wide lint remains unpassed.** The final scoped graph lint result is **0 errors and 18 warnings** (array-index assertions in `orthogonal-routing.ts`); the other new routing/safe-segment files have no diagnostics in that scoped result. Error events now reach the plugin logger without an algorithm change. The build, 431-test and typecheck results above were rerun after the final source adjustments. A scoped check with warnings does not establish a clean repository lint gate.
