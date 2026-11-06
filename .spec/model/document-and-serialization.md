# Document model and serialization

## Document identity and content selection

A `Document` is initialized with an `id`, `documentType`, and `documentVersion`. It selects a compatible content model through `contentTypesRegistry`; the engine creates the document after scenario registrations have occurred. A missing compatible content model is an initialization error.

The document owns props, content, selection, settings, and a timeline. Global document props changes emit the document props-update signal and are recorded in the timeline unless timeline logging is temporarily disabled during restoration.

## Data lifecycle

- `getData()` returns document metadata, props, and the active content model's serialized data.
- `save()` returns that data and records a timeline save point.
- `load(data)` applies data through the timeline.
- Timeline restoration reapplies document props and content without treating restoration as a new user edit.
- Content models are responsible for translating their domain representation to and from serialized content. Node/edge field meanings must remain in the scenario or content-type contract, not in generic UI code.

`contentTypesRegistry` also owns optional external-format transformers. Scenario import/export code registers its own transformer; the generic engine does not assume a particular external workflow format.

## Timeline failure behavior

`Timeline.go(cursor)` clamps the requested cursor to the available range and applies the selected point before updating the cursor. If the applier fails, the error is propagated and the cursor/current point remain unchanged; cursor and state-change events are not emitted for that failed navigation. Timeline suppression is cleared immediately on failure and deferred briefly after successful restoration so asynchronous model observers do not record restoration as a new edit.

## Node and relation representation

The generic content model creates nodes from registered prototypes and tracks relations through content-specific relation implementations. Scenario content may serialize positions and relations differently, but it must preserve stable element identifiers and enough endpoint/port information to rebuild graph connections.

For example, BPMN content stores nodes and edge elements in `elements`, reconstructs relations by source reference, and writes node positions separately from node props. ComfyUI uses a transformer to map its external input links to internal serialized edges. See [BPMN](../scenarios/bpmn.md) and [ComfyUI](../scenarios/comfyui.md).

## Compatibility constraints

- Keep the base model scenario-neutral.
- Preserve document type/version compatibility and serialized shapes when changing a content model.
- Update the relevant scenario format specification and import/export tests when serialized fields change.
- Add generic registry or transformer behavior only when it applies across scenarios.

## Implementation and tests

Primary implementation: `packages/model/src/document/`, `packages/model/src/content/`, and `packages/model/src/registries/content-types-registry.ts`. Timeline behavior is tested under `packages/model/__tests__/timeline.test.ts`; document serialization and restoration are covered by `packages/model/__tests__/document.test.ts` and scenario tests under `apps/*/model/__tests__/` and `apps/*/utils/__tests__/`.

## History and dirty-state semantics

`Document.transaction(title, operation)` and `Timeline.transaction` await synchronous or asynchronous work and its batched model observers before committing one full-document checkpoint. Nested and overlapping transactions share the outer transaction; callers should serialize independent asynchronous commands when separate undo steps are required. `Timeline.beginTransaction` / `endTransaction` support gesture lifetimes; each begin must have a matching end. Logging within a transaction marks it dirty without serializing every intermediate mutation. Failure propagates to the caller; completed partial mutations are checkpointed in `finally` and remain undoable. Transactions do not promise atomic rollback.

At the outer transaction boundary, pending data changes that predate the command are first preserved as their own checkpoint. The effective starting data is then compared with the final data once at commit. A command that compensates all its changes creates no checkpoint, leaves dirty identity and redo intact, and still reconciles an explicit save within the transaction. Nested failures do not roll back their outer caller's successful changes.

The shared Canvas creation commands apply narrower compensation: they own freshly allocated node/edge IDs, revalidate actual target ports before adding a relation, persist both source and target port IDs returned by route resolution, and remove only their own additions if creation fails. Semantic or structural rejection never initiates route fallback; resolved endpoints pass a final strict validation. `Content.rollbackAddedNode(node)` verifies object identity and removes that addition through model lifecycle notifications without invoking user deletion vetoes. This is command compensation, not permission to restore an entire document snapshot after asynchronous failure. Concurrent unrelated data edits and selection changes remain intact; failed creation never selects its temporary node. Ordinary drawn connections use the same final relation-creation validation/defaults path. A failure after relation creation but during graph projection compensates that owned relation as well.

Outside explicit transactions, timeline entries coalesce while the current point is alive (300 ms since its latest log). Saving closes that point. History holds at most 100 detached full-document checkpoints by default (configurable via the Timeline constructor), including its oldest available baseline. Evicted checkpoints release timers. This is bounded checkpoint history, not incremental/delta storage. Dirty state uses stable snapshot revisions, so branching at a previously saved cursor cannot accidentally become clean. Save captures current model data even before deferred props observers run; those observers do not make the unchanged saved document dirty. Save during a transaction is reconciled against the completed checkpoint.

`Document.save()` serializes and marks a save point; it does not perform durable storage. `Document.load()` calls `Timeline.apply()`, applies data under pause/resume, then replaces history with a clean baseline. `Timeline.reset()` likewise creates a clean baseline from current data. Document identity/type/version remain those of the existing document during restoration. `Document.destroy()` releases model props/settings/selection tasks and listeners and history timers; the owning engine calls it during teardown.

**Required contract:** persistent user edits must be recoverable through history, and the modified indicator must distinguish content changed since a save. Loading and persistence integrations must explicitly choose history policy and must not equate a save-point marker with successful external storage.

Regression tests cover save during coalescing and transactions, branch replacement, history bounds, loaded baselines, immutable relation snapshots, and failed nested asynchronous transactions. An applier failure preserves the timeline cursor but does not promise atomic rollback of partially mutated content. Independent overlapping asynchronous transactions currently coalesce; they are not isolated concurrent transactions.

Existing content aspect hooks still convert addition/removal rejection into `null`/`false`, including thrown hook errors; veto and failure are not distinguished by that legacy API. The transaction API propagates errors thrown or rejected by its operation, but does not change those existing hook return semantics.

## Persistent-field change checklist

For each added or changed field, identify its owner and prove the applicable paths:

1. User mutation updates the model, and the graph reflects it without feedback loops.
2. Save → load preserves the field, internal IDs, relation endpoints, ports, and positions.
3. Edit → undo → redo restores before/after values, including the case where the restored node already exists.
4. External import/export documents intentional ID remapping or field loss; internal round-trip guarantees do not imply lossless external conversion.
5. Rejected operations do not report success; any partial-mutation behavior is explicit.

Selection and viewport presentation are transient unless separately specified; `Document.getData()` does not serialize selection. Props and selection enqueue only dirty tasks; flushing removes tasks from the pending set before execution so reentrant edits schedule a later flush. Autosave stores full document data at a shared IndexedDB key, waits for transaction completion, reports abort/error, and prevents overlapping writes. It does not mark manual save points or provide a restore workflow or per-document storage key.

## Copy/paste scope

The copy plugin excludes edges and respects `view.copyable === false`. Its local clipboard captures model node types, positions and detached props at copy time. Paste creates fresh internal IDs, preserves edited props and offsets positions by 30 pixels, and awaits all node additions in one transaction before selecting the created nodes. Edges between copied nodes are not copied. Scenario serial IDs stored in props are preserved; the generic plugin does not invent scenario-specific identity rules. Deletion awaits asynchronous node removal hooks within one transaction; deleting a node removes incident relations, and undo restores them.

**Required contract for a data-preserving copy implementation:** preserve copyable node props while regenerating internal IDs; respect prototype restrictions and keep model/graph/history consistent. Whether edges between selected nodes are included, how scenario serial IDs are regenerated, and whether a multi-node paste is one undo step must be deliberately specified when that feature is changed. Do not infer these product decisions from X6 clipboard defaults.
