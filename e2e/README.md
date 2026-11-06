# Browser verification inventory

## Running tests

`playwright.config.mjs` collects `**/*.spec.{ts,mjs}` in this directory. Files without `.spec` in their names are manual diagnostics, not part of `pnpm test:e2e`. An `.mjs` extension alone does not make a file manual.

Before the full suite, start these in separate terminals:

```sh
pnpm dev:e2e:bpmn
pnpm dev:e2e:comfyui
pnpm dev:e2e:er
```

They must be available on `127.0.0.1:5179`, `5180`, and `5181` respectively. Check that Vite actually bound the requested port. Then run `pnpm test:e2e`. For a focused BPMN case, only its server is needed, for example:

```sh
pnpm exec playwright test e2e/e2e-canvas-quick-add.spec.ts
pnpm exec playwright test e2e/e2e-verify-zoom.spec.ts --grep 'Ctrl\+wheel'
```

The default browser remains Playwright's bundled Chromium. To use an installed Chrome browser, set `PLAYWRIGHT_CHANNEL=chrome`; for example, `PLAYWRIGHT_CHANNEL=chrome pnpm exec playwright test --workers=1`.

## Suite classification

| Files | Purpose / scope |
| --- | --- |
| `port-visual-routing.spec.ts` | Visible terminal segments outside default arrowheads, reversible display-only arrow sizing, and real bottom-port drops resolving to legal ports through history/load |
| `edge-name-inspector.spec.ts` | Connection names are inspector-only metadata; real edge double-click opens no editor and save/load does not restore canvas labels |
| `e2e-canvas-quick-add.spec.ts` | Quick-add UI, keyboard focus, dock tools, panel bounds, selection, absence of selection-action popups, and shared keyboard editing commands |
| `edge-edit-persistence.spec.ts` | Model-owned anchored-edge editing: hover/click stability, segment-drag ports and vertices, undo/redo, source-node movement and serialized document round-trip |
| `edge-interaction-regression.spec.ts` | Rendered hover/selection color versus transparent hit paths; repeated segment drags without closed-loop buildup and restoration of caller styling |
| `connection-policy.spec.ts` | Real BPMN physical-port drops, ordinary bidirectional ports, Start/End restrictions, explained blank-drop pickers and single rejection feedback |
| `workbench-ui-regression.spec.ts` | Header/schema contrast in both themes across scenarios, dock placement without graph movement, same-edge editor translation and preservation of caller colors/data/history |
| `routing-distance-diagnostic.spec.ts` | Close-node port geometry, strict bend limits, rejected node/group/obstacle drags, rejected back-fold connections, visible legacy diagnostics, and generic-port fallback through undo/redo/save/load |
| `routing-contract.spec.ts` | BPMN/ComfyUI/ER moved third-party obstacles, physical port coordinates and tangents, marker semantics, real segment/curve-vertex drag previews, undo/redo and document loading |
| `viewport-correctness.spec.ts` | Large-document presentation culling: crossing edges, real scrolling, fit, selection/copy/undo, programmatic moves and caller-hidden preservation |
| `canvas-input.spec.ts` | Native stencil drop screen-position stability and selection; stable 500ms edge dwell versus immediate existing-node edge pan; ordinary wheel and trackpad pinch with panel/help isolation |
| `performance.spec.ts` | Explicit-server measurements of connected-node drags into free space, native wheel and middle-button pan; actual position/route work and routing-failure counts, plus optional real-drag CPU profiles |
| `e2e-verify-zoom.spec.ts` | Ctrl+wheel case and an older render diagnostic |
| `e2e-verify-fixes.spec.ts`, `e2e-verify-fixes2.spec.ts` | Mixed legacy layout/routing/zoom assertions |
| `e2e-edge-*.spec.ts`, `e2e-edge-*.spec.mjs` | Collected edge interaction/routing tests, some diagnostic or weak assertions |
| `e2e-check-errors.spec.mjs` | Collected browser error diagnostic |
| `e2e-comprehensive.mjs`, `e2e-comprehensive-v2.mjs`, `e2e-verify.mjs` | Manual diagnostics; inspect script-specific setup before running |

Classification describes source intent, not a passing execution baseline. The dated pass counts below are historical records; current integrated acceptance results belong in [the verification guide](../docs/verification.md). Newly listed cases are not implied to have passed by older counts.

Current canvas input accepts both ordinary wheel and Ctrl+wheel pinch; the modifier requirements described in the historical fixture-repair record below no longer describe the product contract. `canvas-input.spec.ts` verifies actual graph zoom for both inputs and verifies that sidebar, inspector and help overlays do not zoom the canvas. Drop assertions compare existing nodes' actual screen bounding boxes and graph client coordinates, then compare the new node center with the pointer and verify graph/model selection.

For a production performance run, serve an existing BPMN build separately and use `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5189 PERF_MODE=production pnpm exec playwright test -c playwright.performance.config.mjs --workers=1`. Default drag distance is 300 screen pixels over 60 mouse steps; `PERF_DRAG_DISTANCE=30` explicitly selects the short comparison. The connected outer-column node moves into free space rather than through another node. Fit-scale dragging keeps the fitted scale and pans only the viewport to an interactive start point. `PERF_PROFILE=1` attaches a profile covering the real drag. Results include actual position events, per-edge route calls, live edge count and routing errors; missing or failed routes must not be presented as successful smooth rendering. Keep browser performance runs separate from full E2E and builds.

## Fixture repairs verified 2026-10-30

The first full Chrome run reproduced four failures from missing fixture prerequisites: an empty initial edge set, selected-edge color confounding hover, and two wheel cases without the required modifier/actual graph zoom measurement. These were test setup defects; they are not evidence of a product regression. No tests were skipped and no acceptance thresholds were lowered.

| Cases | Corrected prerequisite and assertion |
| --- | --- |
| `e2e-verify-fixes.spec.ts`, `e2e-verify-fixes2.spec.ts`, `e2e-verify-zoom.spec.ts` routing cases | `workbench-fixtures.ts` creates a model-owned `SequenceFlow` between explicit Start/End nodes with a bent route, verifies the relation exists and the projected edge is nonempty, then asserts every segment is orthogonal. |
| `e2e-edge-segments.spec.mjs` hover/leave | Explicitly clears graph and model selection and verifies zero selected cells before separately checking hover color and restoration on leave. |
| Wheel cases in `e2e-verify-fixes.spec.ts` and `e2e-verify-fixes2.spec.ts` | Dispatch a Ctrl+wheel event at the canvas and assert that the public graph zoom increases. |

The repaired subset passed **14/14** cases in Chrome; the subsequent complete collection passed **32/32**. The new quick-add/dock/context-actions subset passed **4/4**, including canvas-focused Enter opening (without intercepting input Enter), search, keyboard creation, Escape focus return, outside-pointer focus, constant control dimensions across graph zoom, and shared copy/paste/delete/undo behavior. The floating selection toolbar was subsequently removed; the editing case now checks that no popup appears and exercises copy, paste, delete and undo through their existing scoped keyboard shortcuts. Results apply to the executed fixtures, not to every manual diagnostic or unasserted logging branch in older files.

## Viewport culling correctness

The six-case viewport suite passed **6/6** in Chrome with an explicit 504-node model fixture. It verifies real DOM visibility and screen-space crossing geometry, while requiring graph cell visibility flags and serialized document data to remain unchanged. It also verifies distant-node scrollbar navigation, fit of every model node, exact model restoration after copy/paste undo, programmatic endpoint-move/undo cache refresh, and preservation of caller-hidden cells.

The crossing fixture deliberately has a bend: a perfectly horizontal SVG group has a zero-height geometric bounding box and cannot be validated with Playwright's element-visibility assertion alone. Initial testing found missing distant-scroll extents and stale programmatic edge bounds; both cases passed after their implementation fixes. After integration, the official-config full collection passed **38/38** serially in Chrome, including all six viewport cases, with zero skipped or flaky cases. The earlier **32/32** result predates this new suite.

## Anchored edge editing refinement

`edge-edit-persistence.spec.ts` starts with an explicit model-owned BPMN edge. Hover and a handle click must leave the router, manual vertices and history unchanged. Segment dragging must preserve source/target port bindings and endpoint anchor positions while persisting the edited vertices. The case then checks undo/redo; moving the source node clears the manual bends, reroutes orthogonally and commits the final position and edge state together. Undo restores the prior position and manual geometry, redo clears the bends again, and a `Document.getData()`/`load()` round-trip retains the resulting endpoint bindings and cleared-bend state.

An earlier anchored-edge refinement collection passed **39/39**, with **0 skipped**, **0 unexpected** and **0 flaky** cases in **103.3 seconds**. That is historical evidence predating the latest interaction regression below. Functional pass counts do not establish continuous 60 FPS on large diagrams; the latest development-mode timing observations and remaining lint limitation are recorded in the [verification guide](../docs/verification.md).

## Current port and interaction contract

Port capability is independent of visual port group and position. Ordinary BPMN ports support both directions; Start ports only create outgoing connections and End ports only receive them. Candidate-phase checks enumerate all target-capable ports, while final checks use actual node IDs, actual ports, loop/multiple-edge policy and route feasibility. A picker offered from an incoming-only source stays open with an explained empty state; a rejected completed drop produces one localized warning.

Creation and connection mutations use shared stateless commands rather than Canvas-owned ID/port/relation logic. A successful create-and-connect is one undo step. Rejected creation compensates only its owned additions, bypasses user deletion vetoes for that compensation, and preserves prior data, selection, dirty identity and redo when no unrelated edit occurred. Concurrent unrelated changes remain intact. Explicit empty canonical edge names stay empty; legacy label-only data remains editable, and locale changes do not rewrite user names.

Successful node movement may switch interchangeable directional ports while preserving named/typed semantic identities and scenario validation. An unrelated obstacle can trigger legal generic-port alternatives as well. Final positions, affected edge ports and cleared manual bends commit together, including explicitly reported nonincident reroutes. A move that cannot produce legal routes is rejected: preview and released state return to their prior valid positions/ports/vertices rather than persisting an invalid operation. Group-drag rejection restores the whole moved group.

`edge-interaction-regression.spec.ts` repeatedly drags segment handles and checks orthogonality, bounded geometry without closed-loop buildup, and unchanged transparent wide hit paths. Hover and selection style only the visible path; leaving hover and clearing selection restore the caller's original color and width. Assertions read computed stroke color so inline styles are measured correctly after X6 redraws. The selection case in `e2e-canvas-quick-add.spec.ts` checks absence of a floating action popup and exercises scoped copy/paste/delete/undo shortcuts.

Before the expanded routing and input suites, the official-config full serial Chrome collection passed **40/40**, with **0 skipped**, **0 unexpected** and **0 flaky** cases in **109.6 seconds**. All three documented servers were running on 5179/5180/5181. An initial 38-pass/two-failure attempt exposed old attribute-only color assertions; rendered computed-style assertions retained the expected colors, then the focused **3/3** subset and full **40/40** collection passed. No cases were skipped and no color expectations were weakened. Report: `/private/tmp/flow-designer-core-fix-e2e-final.json`.

## Routing mode and obstacle contract

`routing-contract.spec.ts` creates model-owned BPMN, ComfyUI and ER fixtures with two unrelated obstacle nodes. It moves an obstacle into an existing path in a document transaction, checks the resulting rendered path against every node body, and verifies exact source/target port coordinates and both endpoint tangents. Undo restores the original path; redo restores the detour. BPMN retains its arrow and orthogonal mode; ComfyUI and ER retain their arrow-free port-tangent curves.

The same cases perform a real segment or curve-vertex drag. A snapshot before mouseup checks that routing mode, port bindings and obstacle clearance hold during the drag, then model vertices, undo/redo and save/load are verified. Orthogonal preview routing remains active throughout the drag. Curve waypoint editing commits through the shared vertex-commit event. Moving a node still dynamically switches only generic directional ports, preserves semantic port identities, and clears manual bends as one history operation.

The targeted routing and earlier edge-interaction collection passed **8/8** serially in Chrome after these changes. This is focused evidence; the prior **40/40** full-suite result predates the new routing cases. Large-diagram culling additionally listens for geometry invalidation when an unrelated obstacle changes a rendered path without changing edge model data.

Current orthogonal operations enforce a strict maximum of **three bends** after redundant points are normalized. This applies to new connections and newly accepted drag/edit results, with exact port attachment, outward endpoint directions and obstacle clearance. The bounded search does not promise a globally shortest path. If the requested port pairing cannot meet those constraints, another legal generic-port combination may be tried; otherwise the new operation is rejected and its owned mutations are rolled back. A failed route must not be accepted by hiding its edge, disconnecting its displayed endpoints or silently persisting a longer back-fold.

Loading old data is a separate compatibility path. A previously stored legal path requiring more bends remains visible with a degradation warning. Physically impossible old geometry remains visibly diagnosed rather than disappearing: the view exposes routing-error metadata and a visible diagnostic stroke, and reports degradation through its dedicated event. The workbench aggregates that warning per loaded document baseline rather than emitting a toast for each edge. Repairing the old geometry clears the diagnostic and restores caller styling; undo can restore the diagnosed state without losing model relations or marker semantics. `routing-distance-diagnostic.spec.ts` explicitly distinguishes these legacy cases from rejection/rollback of new operations.

Earlier routing passes recorded above predate this stricter three-bend and visible-legacy-diagnostic contract. In particular, the former failure behavior that left endpoints disconnected is historical and is not the current acceptance rule. Functional correctness still does not establish a universal frame-rate guarantee.

## Fixture contract

Wait for an initialized graph, register scenario edge types before creating fixture edges, and explicitly seed the nodes/edges required by a test. Verify fixture creation before looping over results. Keep state local to each page/test. Floating panels can cover valid graph coordinates: before a real node/edge/handle pointer action, verify that `document.elementFromPoint` at the intended screen point resolves to the intended cell or tool, rather than relying only on `localToClient`, a bounding box or scroll offsets. Pan only the viewport or choose an uncovered target when preparing such a fixture; do not change the model merely to bypass coverage. A collapsed inspector retains its visible shell/reopen toggle while its body is hidden, so assert the toggle and body state separately instead of expecting the entire inspector locator to disappear. For persistence tests, compare model data after save/load and undo/redo, including props, ports and manual vertices; a correct screenshot alone cannot establish persistence.

## Floating workspace and visible port regressions

The sidebar belongs to `canvasWorkspace` and remains an overlay. Dock centering follows only sidebar visibility; inspector expansion does not shift it. Inspector height reserves the measured dock strip and scrolls internally. The workbench suite includes actual control hit tests and short/narrow windows, rather than visibility alone.

For port-direction checks, a mathematically correct subpixel stub is insufficient: the visual-routing suite checks visible terminal distance beyond the default arrowhead. Default arrows may shrink in constrained gaps without mutating serialized marker attributes; custom markers retain their definitions. When fixed generic ports cannot form a legal short path, drop resolution first preserves the source and tries other eligible target ports, then considers eligible source alternatives. Capability and semantic rejections never trigger this fallback, and named/typed ports retain their identities.
