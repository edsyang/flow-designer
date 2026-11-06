# BPMN scenario

This specification covers the BPMN example's bootstrap sequence, process document contract, and scenario-owned graph types. It does not define BPMN XML import/export or execution semantics; those are not implemented by this scenario.

## Ownership

| Concern | Owner | Contract |
| --- | --- | --- |
| Process document and relation data | `apps/bpmn/model` | Process-specific persistence, flow-in tracking, and serial IDs |
| BPMN node prototypes, port policy, and Sequence Flow appearance | `apps/bpmn/nodes` | Node schemas/views, directional connection validation, and edge type configuration |
| Runtime setup and initial example document | `apps/bpmn/app` | Registers scenario types, seeds the document, and mounts the workbench |
| Canvas rendering and model synchronization | `packages/graph` and `packages/plugins` | Generic X6 projection and graph/model bridge; no BPMN policy |

## Bootstrap ordering

`apps/bpmn/app/src/app.tsx` performs these steps in order:

1. Register `ProcessContent` and all BPMN node prototypes at module evaluation time, before creating the designer. `createDesigner` constructs the document using these registries.
2. Call `createDesigner` with document type `process`, version `1.0.0`, settings obtained from the `ProcessGlobal` prototype, and a connection validator that allows only outgoing-to-incoming port connections.
3. Add the BPMN title to `Header` and subscribe once to `graph:ready`. The callback registers `SequenceFlow` with the graph manager.
4. Pause the document timeline, add a `StartEvent` at `(200, 200)` and an `EndEvent` at `(600, 200)`, resume the timeline, then reset it so the seeded example is the clean initial history state.
5. Render `Workbench`. The graph plugin mounts into the workbench's main area and emits `graph:ready`; therefore the one-shot listener must be installed before this render.

The starter document intentionally contains two nodes and **no sequence flow**. Registering the edge type makes it available for subsequent user-created connections; it does not create an edge. E2E cases that require an edge must create one in their setup or load a fixture containing one.

`GraphManager.getDefaultEdgeType()` currently returns the first registered edge type. Since the app registers `SequenceFlow` before mounting the graph, new connections use its router, connector, and line attributes. Do not rely on registration order if the graph API later gains an explicit default-edge option.

## Process data contract

`ProcessContent.compatibleType` is `process`; its compatible version range is `~1.0.0`.

The serialized `elements` array contains both node and edge records:

- A node has `id`, `typeName`, `props`, and `position`.
- An edge has `id`, `typeName`, `sourceRef`, `targetRef`, and optional `sourcePort`, `targetPort`, `props`, and `vertices`.
- On load, records with `sourceRef` are grouped by source ID and passed to that source node's `ProcessRelation`; other records are created as nodes. Node `position` is supplied to the model through the internal `__position` prop and is emitted as the top-level `position` field when saved.
- On save, every node relation is serialized as edge records. An absent edge type is emitted as `SequenceFlow`.

`ProcessRelation` owns outgoing serialized edges. It maintains a derived list of incoming source node IDs: `addEdge`/`removeEdge` and relation initialization/purge update the target relation when that target exists. Incoming IDs are deduplicated. A change to this logic must preserve both live edits and load/undo restoration.

Removing an edge by ID retains the incoming source while another parallel edge still connects the same pair. `updateEdge(id, patch)` updates endpoints, ports, vertices or props through detached relation snapshots and emits change/history notifications; reconnecting to another target updates both targets' incoming IDs. Moving between source relations uses a document transaction around remove/add. Restore rebuilds derived incoming IDs after all nodes and outgoing relations are restored, including existing nodes. Deleting a target removes incoming edges from its surviving sources; undo restores the target, its edges and incoming IDs.

`ProcessContent.getSerialId(namespace, value, forceGenerator)` supplies IDs against the current nodes' `sid` props; `getNodeBySerialId` resolves a node by that prop. Keep this identity separate from the framework's internal node IDs.

## Current constraints and edge cases

- The process relation casts target relations to `ProcessRelation`. `ProcessContent` must therefore be used with compatible nodes and content; do not attach arbitrary generic content nodes to it.
- The process-global settings are obtained from the registered `ProcessGlobal` prototype. Changing its registered type name or schema must update the lookup and any settings consumers together.
- The default flow-out ID is held on `ProcessRelation`; it is not part of the serialized edge fields above. Before changing gateway default-flow behavior, trace where that ID is consumed and define whether it must survive save/load.
- `StartEvent` declares four outgoing-only ports and `EndEvent` four incoming-only ports. All other BPMN ports are bidirectional. Explicit `connectionDirection` controls capability independently of geometry and legacy IDs; the validator uses the same capability helper as graph connection creation. An outgoing attempt from an end opens an empty picker with a translated explanation.
- Double-clicking blank canvas space opens the shared quick-add panel for registered visual node prototypes. The chosen prototype is added to the process document at the click position and selected. `StartEvent` and `EndEvent` remain available in the stencil but are excluded from quick-add.
- `graph:ready` is a one-shot signal. Changes to app mount timing must keep edge registration before the user can create a connection and must not move the subscription after workbench rendering.
- The current E2E edge-routing case in `e2e/e2e-verify-fixes.spec.ts` asserts that the starter BPMN page already has an edge. That precondition conflicts with the bootstrap contract above; a failure of that assertion alone does not demonstrate a routing defect.
- Canvas wheel accepts unmodified scrolling and modifier-based trackpad pinch. `e2e/canvas-input.spec.ts` asserts actual zoom changes for both and verifies that sidebar, inspector and help-modal wheel events leave canvas zoom unchanged.
- `e2e/e2e-edge-segments.spec.mjs` currently observes a blue edge stroke after its pointer-leave step. Blue is also the graph's edge-selection color, so the assertion must distinguish lingering hover from a still-selected edge before attributing the result to hover cleanup.

These are current implementation/test observations, not endorsements of weak tests. Keep the product contract and the E2E fixture preconditions aligned when updating either side.

## Verification map

| Change area | Existing coverage |
| --- | --- |
| Content registration, node creation, props, serial IDs, relation tracking, and relation serialization | `apps/bpmn/model/__tests__/bpmn-model.test.ts`, `apps/bpmn/model/__tests__/integration.test.ts` |
| Timeline restoration of process edges | `apps/bpmn/model/__tests__/integration.test.ts` (`undo/redo restores edge data for existing nodes`) |
| Node prototype registration and schemas | `apps/bpmn/nodes/__tests__/bpmn-nodes.test.ts` |
| App bootstrap, graph rendering, and interactive edge behavior | `e2e/`; note each case's fixture preconditions and interaction modifiers |

When changing the process serialization shape, add or update a round-trip test. When changing app wiring, verify the one-shot graph-ready ordering and run the relevant BPMN E2E case with its required services available.
