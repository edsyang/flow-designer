# Connection validation

## Ownership and call path

The scenario app chooses semantic compatibility policy; `packages/graph` adapts that policy to X6. `GraphOptions.connecting.connectionValidator` is optional. When supplied, X6's `validateConnection` callback resolves each endpoint's cell ID and port ID, looks up the corresponding registered `PortDefinition`, builds a `ConnectionContext`, and returns the validator's synchronous boolean result.

The context always has `sourceNode` and `targetNode` strings. If X6 supplies no endpoint cell, the graph adapter currently uses an empty string for that node ID. `sourcePort` and `targetPort` are `PortDefinition | null`; absent or unresolvable port IDs become `null`. Port lookup accepts either the declared port ID or the generated `${group}-${position}` ID used when a definition omits `id`.

Every committed connection first requires real endpoint nodes and registered ports with compatible source/target capabilities. `allowAll` and an absent scenario validator do not bypass these structural checks. `canUsePort` reads `connectionDirection` when declared, otherwise preserves legacy `in`/`out` group direction. Port position is independent of capability.

A connection drag that currently has no target cell (a blank drop) is not judged by the semantic validator: `validateConnection` returns `true` for it so the temporary edge can be intercepted, because the validator cannot inspect a target port that does not exist yet. `evaluateConnection(context, { phase: "candidate" })` checks prototype port capabilities and returns a deferred result without invoking an instance validator with a fabricated node ID. Validators can optionally expose `validatePorts` for pure prototype metadata filtering; built-in type/direction validators do so. Commit phase (also used by boolean `checkConnection`) checks real node/port existence, structural rules, and scenario validation. Rejections carry translatable reason keys; hover checks remain silent and final drop emits one `connection:rejected` event.

## Independent X6 rules

`allowBlank`, `allowLoop`, and `allowMulti` are separate X6 connection options. `allowLoop` and `allowMulti` default to `false` and `true`. `allowBlank` interacts with `connecting.onBlankDrop` (see below): with the default `"choose-node"` policy the graph adapter enables X6 `allowBlank` internally so the drop can be intercepted, and with `"ignore"` the option's own default (`false`) applies. A custom validator or `allowAll` does not override those options, endpoint shape constraints, or other X6 checks. `highlight` affects connection presentation, not compatibility.

## Blank drops

Dropping a connection drag over empty canvas is not a persistence action. The graph adapter accepts the X6 blank terminal, retains the temporary edge while the picker is open, and emits `connection:blank` with:

- `sourceCellId`: the node the drag started from;
- `sourcePortId`: the source port, or `null` when the node exposes no ports;
- `x` / `y`: the drop point in graph coordinates;
- optional `reason`: a translatable capability rejection key for an explained empty picker.

No model relation is created by the blank drop. The workbench removes the temporary edge on completion or cancellation. It enumerates every source/target-capable port rather than selecting a geometric `in` group, filters candidates with candidate-phase checks, then validates the newly created real target again before adding its relation. An incoming-only source still opens an empty picker with its reason. GraphBridge ignores incomplete edges.

Set `connecting.onBlankDrop: "ignore"` to keep plain X6 behavior instead.

## Built-in semantic policies

| Validator | Accepts | Rejects |
| --- | --- | --- |
| `sameDataType` | A source port has a non-null `dataType` and it exactly equals the target port's `dataType`. | Missing source port/type, missing target port, or unequal values. Matching `undefined` values are not accepted. |
| `directionOnly` | `canUsePort(sourcePort, "source")` and `canUsePort(targetPort, "target")`. | Missing ports or any other group/direction, including reversed endpoints. |
| `allowAll` | Every semantic context (the implementation does not inspect its arguments). | Nothing semantically. |

These policies read model metadata only. `position`, `color`, and `label` are presentation/layout metadata and do not imply type or direction semantics.

## Scenario policy

The scenario app is responsible for selecting a validator that matches its domain. ComfyUI declares typed ports and uses `sameDataType` when configured; ER currently configures `allowAll` despite declaring `ROW`, `REFERENCE`, and `ENUM_VALUE` port types. BPMN uses four geometrical ports per node: starts explicitly allow only outgoing connections, ends only incoming, and every other node allows both directions on every side. Existing port IDs remain unchanged. See [ComfyUI](../scenarios/comfyui.md), [ER](../scenarios/er.md), and [BPMN](../scenarios/bpmn.md).

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

## Final generic port resolution

`evaluateConnection` validates the exact requested endpoints. `resolveConnection` is a pure commit-time resolver: if a geometrically invalid request uses interchangeable geometry-only ports (no explicit ID, label, or data type), it first keeps the requested source and tries legal target ports; only then may it try another interchangeable source. Feasible pairs are ranked by length and bends. A valid original pair is retained. Semantic/capability rejection is never bypassed, and named/typed fields are never substituted. Native final drop and shared creation commands apply the returned source/target IDs before persistence; hover and candidate queries do not change endpoints.
