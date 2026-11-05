# Connection validation

## Ownership and call path

The scenario app chooses semantic compatibility policy; `packages/graph` adapts that policy to X6. `GraphOptions.connecting.connectionValidator` is optional. When supplied, X6's `validateConnection` callback resolves each endpoint's cell ID and port ID, looks up the corresponding registered `PortDefinition`, builds a `ConnectionContext`, and returns the validator's synchronous boolean result.

The context always has `sourceNode` and `targetNode` strings. If X6 supplies no endpoint cell, the graph adapter currently uses an empty string for that node ID. `sourcePort` and `targetPort` are `PortDefinition | null`; absent or unresolvable port IDs become `null`. Port lookup accepts either the declared port ID or the generated `${group}-${position}` ID used when a definition omits `id`.

If no semantic validator is configured, the graph adapter returns `true`. This means only that the application adds no extra semantic rejection; X6's other connection rules remain active.

A connection drag that currently has no target cell (a blank drop) is not judged by the semantic validator: `validateConnection` returns `true` for it so the temporary edge can be intercepted, because the validator cannot inspect a target port that does not exist yet. The validator runs when that pending drop is completed, either through `IGraphManager.checkConnection` while offering candidate nodes or through X6 once a real target exists.

## Independent X6 rules

`allowBlank`, `allowLoop`, and `allowMulti` are separate X6 connection options. `allowLoop` and `allowMulti` default to `false` and `true`. `allowBlank` interacts with `connecting.onBlankDrop` (see below): with the default `"choose-node"` policy the graph adapter enables X6 `allowBlank` internally so the drop can be intercepted, and with `"ignore"` the option's own default (`false`) applies. A custom validator or `allowAll` does not override those options, endpoint shape constraints, or other X6 checks. `highlight` affects connection presentation, not compatibility.

## Blank drops

Dropping a connection drag over empty canvas is not a persistence action. The graph adapter accepts the X6 blank terminal, removes the temporary edge immediately, and emits `connection:blank` with:

- `sourceCellId`: the node the drag started from;
- `sourcePortId`: the source port, or `null` when the node exposes no ports;
- `x` / `y`: the drop point in graph coordinates.

No model relation and no X6 cell survives the drop. The workbench (`packages/react/src/panels/canvas.tsx`) opens the node picker at that point and, once a prototype is chosen, creates the node and a `SerializedRelation` from the source port to the new node's default `in` port inside one `Document.transaction`, so a single undo removes both. Candidate prototypes are filtered through `IGraphManager.checkConnection` using their default `in` port, so a node the scenario validator would refuse is not offered as a target. `GraphBridge` ignores blank connections, so a dangling edge can never become a relation.

Set `connecting.onBlankDrop: "ignore"` to keep plain X6 behavior instead.

## Built-in semantic policies

| Validator | Accepts | Rejects |
| --- | --- | --- |
| `sameDataType` | A source port has a non-null `dataType` and it exactly equals the target port's `dataType`. | Missing source port/type, missing target port, or unequal values. Matching `undefined` values are not accepted. |
| `directionOnly` | `sourcePort.group === 'out'` and `targetPort.group === 'in'`. | Missing ports or any other group/direction, including reversed endpoints. |
| `allowAll` | Every semantic context (the implementation does not inspect its arguments). | Nothing semantically. |

These policies read model metadata only. `position`, `color`, and `label` are presentation/layout metadata and do not imply type or direction semantics.

## Scenario policy

The scenario app is responsible for selecting a validator that matches its domain. ComfyUI declares typed ports and uses `sameDataType` when configured; ER currently configures `allowAll` despite declaring `ROW`, `REFERENCE`, and `ENUM_VALUE` port types. BPMN configures outgoing-to-incoming validation; its start/end node port definitions therefore prevent incoming connections to starts and outgoing connections from ends. See [ComfyUI](../scenarios/comfyui.md), [ER](../scenarios/er.md), and [BPMN](../scenarios/bpmn.md).

## Change constraints

- Keep the callback synchronous, deterministic, and free of model mutations; it can be invoked repeatedly while the user is drawing a connection.
- Do not infer semantic compatibility from port color or visual position.
- If changing ID fallback or port lookup, preserve connections for definitions both with and without explicit `id`.
- Keep semantic rejection distinct from X6 structural options so a validator cannot accidentally re-enable blank, loop, or multiple connections.
- When changing scenario policy, test both valid and invalid connections in that scenario; do not change ER's permissive policy implicitly while changing generic validation.

## Implementation and verification

- Context assembly and X6 option wiring: `packages/graph/src/graph-manager.ts` (`init`, `validateConnection`, `checkConnection`, `getPortDefinition`, `setupBlankConnection`).
- Built-ins: `packages/graph/src/validators.ts`.
- Validator unit cases: `packages/graph/__tests__/validators.test.ts` (equal and unequal types, missing ports/types, direction, and permissive policy).
- Blank-drop interception: `packages/graph/__tests__/graph-manager.test.ts` ("blank connection drops": emits the payload, keeps connections that end on a node, ignores terminal changes of existing edges, honors `onBlankDrop: "ignore"`, keeps blanks reachable when the validator refuses ports, and judges candidates through `checkConnection`).
- Graph registration/port lookup: `packages/graph/__tests__/graph-manager.test.ts`.
- Scenario selection: `apps/comfyui/app/src/app.tsx` and `apps/er/app/src/app.tsx`.

When modifying behavior, add an integration test for the X6 callback as well as policy unit tests when the change affects endpoint resolution, defaults, or the interaction with `allowBlank`, `allowLoop`, or `allowMulti`.
